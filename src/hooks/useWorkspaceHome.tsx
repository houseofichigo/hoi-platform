import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { MODULES } from "@/lib/curriculum";

export interface ResumeData {
  assess: { moduleNum: number; moduleTitle: string; progress: number; started: boolean };
  build: { total: number; readyToScore: number; scored: number; submitted: number; pending: number };
  scale: { active: number; pilot: number; live: number; openFlags: number; pendingReviews: number; pendingApproval: number };
}

export interface TeamStatus {
  assess: { completed: number; total: number; membersStarted: number };
  discover: { items: number };
  build: { total: number; scored: number; pending: number };
  scale: { live: number; pilot: number; active: number; openFlags: number; pendingReviews: number };
}

export interface AttentionItem {
  id: string;
  kind: "urgent" | "info";
  description: string;
  timestamp: string;
  actionLabel: string;
  actionTo?: string;
}

export interface ActivityEvent {
  id: string;
  kind: "invite_sent" | "invite_accepted" | "workspace_created" | "member_joined";
  description: string;
  timestamp: string;
}

export function useUserProfile() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

async function fetchBuildCounts(workspaceId: string) {
  const [ucRes, scoresRes, approvalsRes] = await Promise.all([
    supabase.from("use_cases").select("id, status").eq("workspace_id", workspaceId),
    supabase
      .from("use_case_scores")
      .select("use_case_id, use_cases!inner(workspace_id)")
      .eq("use_cases.workspace_id", workspaceId),
    supabase
      .from("use_case_approvals")
      .select("decision, use_case_id, use_cases!inner(workspace_id)")
      .eq("use_cases.workspace_id", workspaceId),
  ]);
  const useCases = ucRes.data ?? [];
  const scoredIds = new Set((scoresRes.data ?? []).map((s: { use_case_id: string }) => s.use_case_id));
  const approvals = approvalsRes.data ?? [];
  const total = useCases.length;
  const scored = scoredIds.size;
  const submitted = useCases.filter((u) => u.status === "submitted").length;
  const pending = approvals.filter((a: { decision: string }) => a.decision === "pending").length;
  const readyToScore = useCases.filter((u) => !scoredIds.has(u.id) && u.status !== "draft").length;
  return { total, scored, submitted, pending, readyToScore };
}

async function fetchScaleCounts(workspaceId: string) {
  const [entriesRes, flagsRes, reviewsRes] = await Promise.all([
    supabase
      .from("roadmap_entries")
      .select("id, stage, use_case_id")
      .eq("workspace_id", workspaceId),
    supabase
      .from("governance_flags")
      .select("id, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("post_pilot_reviews")
      .select("use_case_id")
      .eq("workspace_id", workspaceId),
  ]);
  const entries = entriesRes.data ?? [];
  const flags = flagsRes.data ?? [];
  const reviewedIds = new Set((reviewsRes.data ?? []).map((r) => r.use_case_id));
  const active = entries.filter((e) => e.stage !== "backlog" && e.stage !== "retired").length;
  const pilot = entries.filter((e) => e.stage === "pilot").length;
  const live = entries.filter((e) => e.stage === "production" || e.stage === "scaling").length;
  const openFlags = flags.filter((f) => f.status === "open" || f.status === "in_progress").length;
  const pendingReviews = entries.filter((e) => e.stage === "pilot" && !reviewedIds.has(e.use_case_id)).length;
  return { active, pilot, live, openFlags, pendingReviews };
}

export function useResumeData() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  return useQuery({
    enabled: !!workspace && !!user,
    queryKey: ["resume", workspace?.id, user?.id],
    queryFn: async (): Promise<ResumeData> => {
      const { data, error } = await supabase
        .from("assess_progress")
        .select("module_id, status, current_step")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id);
      if (error) throw error;
      const rows = data ?? [];
      const byId = new Map(rows.map((r) => [r.module_id, r]));
      const started = rows.length > 0;
      const completedCount = rows.filter((r) => r.status === "complete").length;
      let currentModuleId = MODULES[MODULES.length - 1].id;
      for (const m of MODULES) {
        const r = byId.get(m.id);
        if (!r || r.status !== "complete") {
          currentModuleId = m.id;
          break;
        }
      }
      const current = MODULES.find((m) => m.id === currentModuleId)!;
      const progress = Math.round((completedCount / 12) * 100);
      const [build, scale] = await Promise.all([
        fetchBuildCounts(workspace!.id),
        fetchScaleCounts(workspace!.id),
      ]);
      return {
        assess: { started, moduleNum: current.num, moduleTitle: current.title, progress },
        build,
        scale: { ...scale, pendingApproval: build.pending },
      };
    },
  });
}

export function useTeamStatus() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["team-status", workspace?.id],
    queryFn: async (): Promise<TeamStatus> => {
      const [completedRes, anyRes, libraryRes, build, scale] = await Promise.all([
        supabase
          .from("assess_progress")
          .select("user_id, module_id")
          .eq("workspace_id", workspace!.id)
          .eq("status", "complete"),
        supabase
          .from("assess_progress")
          .select("user_id")
          .eq("workspace_id", workspace!.id),
        supabase
          .from("library_items")
          .select("id", { count: "exact", head: true })
          .is("workspace_id", null)
          .eq("published", true),
        fetchBuildCounts(workspace!.id),
        fetchScaleCounts(workspace!.id),
      ]);
      if (completedRes.error) throw completedRes.error;
      if (anyRes.error) throw anyRes.error;
      const completed = completedRes.data?.length ?? 0;
      const membersStarted = new Set((anyRes.data ?? []).map((r) => r.user_id)).size;
      return {
        assess: { completed, total: 12, membersStarted },
        discover: { items: libraryRes.count ?? 0 },
        build: { total: build.total, scored: build.scored, pending: build.pending },
        scale,
      };
    },
  });
}

export function useAttentionItems() {
  const { workspace, isAdmin } = useWorkspace();
  const slug = workspace?.slug;
  return useQuery({
    enabled: !!workspace && isAdmin,
    queryKey: ["attention", workspace?.id],
    queryFn: async (): Promise<AttentionItem[]> => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const items: AttentionItem[] = [];

      const [invitesRes, approvalsRes, flagsRes, pilotEntriesRes, reviewsRes, blockedRes] =
        await Promise.all([
          supabase
            .from("workspace_invitations")
            .select("id, status, created_at")
            .eq("workspace_id", workspace!.id)
            .eq("status", "pending")
            .gte("created_at", sevenDaysAgo),
          supabase
            .from("use_case_approvals")
            .select("id, decision, use_cases!inner(workspace_id)")
            .eq("decision", "pending")
            .eq("use_cases.workspace_id", workspace!.id),
          supabase
            .from("governance_flags")
            .select("id, severity, status")
            .eq("workspace_id", workspace!.id)
            .in("status", ["open", "in_progress"]),
          supabase
            .from("roadmap_entries")
            .select("use_case_id, stage")
            .eq("workspace_id", workspace!.id)
            .eq("stage", "pilot"),
          supabase
            .from("post_pilot_reviews")
            .select("use_case_id")
            .eq("workspace_id", workspace!.id),
          supabase
            .from("audit_log")
            .select("id, created_at, action_type")
            .eq("workspace_id", workspace!.id)
            .eq("action_type", "roadmap_transition_blocked")
            .gte("created_at", sevenDaysAgo)
            .order("created_at", { ascending: false }),
        ]);

      const pendingInvites = invitesRes.data?.length ?? 0;
      if (pendingInvites > 0) {
        items.push({
          id: "pending-invites",
          kind: "info",
          description: `${pendingInvites} pending invitation${pendingInvites === 1 ? "" : "s"}`,
          timestamp: "last 7 days",
          actionLabel: "Manage invites",
          actionTo: `/app/${slug}/invite`,
        });
      }

      const pendingApprovals = approvalsRes.data?.length ?? 0;
      if (pendingApprovals > 0) {
        items.push({
          id: "pending-approvals",
          kind: "urgent",
          description: `${pendingApprovals} use case${pendingApprovals === 1 ? "" : "s"} waiting for your approval`,
          timestamp: "Build",
          actionLabel: "Review",
          actionTo: `/app/${slug}/build/approvals`,
        });
      }

      const flags = flagsRes.data ?? [];
      const hardStops = flags.filter((f) => f.severity === "hard_stop").length;
      const requiresAction = flags.filter((f) => f.severity === "requires_action").length;
      if (hardStops > 0) {
        items.push({
          id: "hard-stop-flags",
          kind: "urgent",
          description: `${hardStops} blocking governance issue${hardStops === 1 ? "" : "s"} to resolve`,
          timestamp: "Scale · Governance",
          actionLabel: "Open governance",
          actionTo: `/app/${slug}/scale/governance`,
        });
      }
      if (requiresAction > 0) {
        items.push({
          id: "requires-action-flags",
          kind: "urgent",
          description: `${requiresAction} governance item${requiresAction === 1 ? "" : "s"} needing acknowledgement`,
          timestamp: "Scale · Governance",
          actionLabel: "Open governance",
          actionTo: `/app/${slug}/scale/governance`,
        });
      }

      const reviewedIds = new Set((reviewsRes.data ?? []).map((r) => r.use_case_id));
      const pilotsAwaiting = (pilotEntriesRes.data ?? []).filter(
        (e) => !reviewedIds.has(e.use_case_id),
      );
      if (pilotsAwaiting.length > 0) {
        const single = pilotsAwaiting.length === 1;
        items.push({
          id: "pilot-reviews",
          kind: "info",
          description: `${pilotsAwaiting.length} pilot${single ? "" : "s"} need${single ? "s" : ""} a post-pilot review before going live`,
          timestamp: "Scale · Pilot",
          actionLabel: single ? "Submit review" : "Review pilots",
          actionTo: single
            ? `/app/${slug}/scale/${pilotsAwaiting[0].use_case_id}/review`
            : `/app/${slug}/scale/roadmap`,
        });
      }

      const blocked = blockedRes.data ?? [];
      if (blocked.length > 0) {
        items.push({
          id: "blocked-transitions",
          kind: "urgent",
          description: `${blocked.length} recent roadmap move${blocked.length === 1 ? " was" : "s were"} blocked`,
          timestamp: "last 7 days",
          actionLabel: "View audit log",
          actionTo: `/app/${slug}/scale/audit`,
        });
      }

      return items;
    },
  });
}

export function useRecentActivity() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["activity", workspace?.id],
    queryFn: async (): Promise<ActivityEvent[]> => {
      const [{ data: invites }, { data: members }, { data: ws }] = await Promise.all([
        supabase
          .from("workspace_invitations")
          .select("id, email, status, created_at, accepted_at")
          .eq("workspace_id", workspace!.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("workspace_members")
          .select("id, user_id, role, joined_at")
          .eq("workspace_id", workspace!.id)
          .order("joined_at", { ascending: true })
          .limit(20),
        supabase
          .from("workspaces")
          .select("created_at")
          .eq("id", workspace!.id)
          .maybeSingle(),
      ]);

      const events: ActivityEvent[] = [];

      (invites ?? []).forEach((inv) => {
        events.push({
          id: `inv-sent-${inv.id}`,
          kind: "invite_sent",
          description: `Invitation sent to ${inv.email}`,
          timestamp: inv.created_at,
        });
        if (inv.status === "accepted" && inv.accepted_at) {
          events.push({
            id: `inv-acc-${inv.id}`,
            kind: "invite_accepted",
            description: `${inv.email} joined the workspace`,
            timestamp: inv.accepted_at,
          });
        }
      });

      if (ws?.created_at) {
        events.push({
          id: `ws-created`,
          kind: "workspace_created",
          description: `Workspace created`,
          timestamp: ws.created_at,
        });
      }
      (members ?? []).slice(1).forEach((m) => {
        events.push({
          id: `mem-${m.id}`,
          kind: "member_joined",
          description: `A new ${m.role} joined the workspace`,
          timestamp: m.joined_at,
        });
      });

      return events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
    },
  });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  return `${Math.floor(mo / 12)} year ago`;
}
