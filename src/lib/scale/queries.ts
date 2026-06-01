import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  RoadmapEntryWithRelations,
  StageHistoryEntry,
  OwnerProfile,
} from "./types";

export const roadmapEntriesQO = (workspaceId: string | undefined) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "roadmap_entries", workspaceId],
    queryFn: async (): Promise<RoadmapEntryWithRelations[]> => {
      const { data, error } = await supabase
        .from("roadmap_entries")
        .select(
          `id, workspace_id, use_case_id, owner_id, stage, target_quarter, priority_score, created_at, updated_at,
           use_cases ( id, name, function, created_by ),
           use_case_scores ( classification, quadrant, priority ),
           governance_flags ( id, severity, status ),
           post_pilot_reviews ( id, recommendation, submitted_at )`,
        )
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RoadmapEntryWithRelations[];
    },
  });

export const governanceFlagsQO = (workspaceId: string | undefined) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "governance_flags_summary", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_flags")
        .select("id, severity, status")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return data ?? [];
    },
  });

export const recentStageHistoryQO = (workspaceId: string | undefined, limit = 5) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "recent_stage_history", workspaceId, limit],
    queryFn: async (): Promise<StageHistoryEntry[]> => {
      const { data, error } = await supabase
        .from("roadmap_stage_history")
        .select(
          "id, roadmap_entry_id, use_case_id, from_stage, to_stage, reason, changed_by, changed_at, use_cases(name)",
        )
        .eq("workspace_id", workspaceId!)
        .order("changed_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as StageHistoryEntry[];
    },
  });

export const postPilotReviewsCountsQO = (workspaceId: string | undefined) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "post_pilot_review_counts", workspaceId],
    queryFn: async () => {
      const [reviews, pilotEntries] = await Promise.all([
        supabase
          .from("post_pilot_reviews")
          .select("use_case_id", { count: "exact" })
          .eq("workspace_id", workspaceId!),
        supabase
          .from("roadmap_entries")
          .select("use_case_id")
          .eq("workspace_id", workspaceId!)
          .eq("stage", "pilot"),
      ]);
      const reviewed = new Set((reviews.data ?? []).map((r) => r.use_case_id));
      const pending = (pilotEntries.data ?? []).filter((p) => !reviewed.has(p.use_case_id)).length;
      return { submitted: reviews.count ?? 0, pending };
    },
  });

export const auditMonthCountQO = (workspaceId: string | undefined) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "audit_month_count", workspaceId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(1);
      since.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId!)
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

export const workspaceMembersQO = (workspaceId: string | undefined) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "workspace_member_profiles", workspaceId],
    queryFn: async (): Promise<OwnerProfile[]> => {
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids);
      return (profiles ?? []) as OwnerProfile[];
    },
  });

export interface GovernanceFlagRow {
  id: string;
  workspace_id: string;
  use_case_id: string;
  roadmap_entry_id: string | null;
  rule_code: string;
  rule_source: "sdaia" | "pdpl" | "ndmo" | "nca_sama" | "saip" | "internal_policy" | string;
  severity: "hard_stop" | "requires_action" | "advisory" | string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk" | "not_applicable" | string;
  assignee_id: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  use_cases: { id: string; name: string; function: string } | null;
  roadmap_entries: { id: string; stage: string } | null;
}

export const governanceFlagsFullQO = (workspaceId: string | undefined) =>
  queryOptions({
    enabled: !!workspaceId,
    queryKey: ["scale", "governance_flags_full", workspaceId],
    queryFn: async (): Promise<GovernanceFlagRow[]> => {
      const { data, error } = await supabase
        .from("governance_flags")
        .select(
          `id, workspace_id, use_case_id, roadmap_entry_id, rule_code, rule_source, severity, status,
           assignee_id, resolution_notes, created_at, updated_at,
           use_cases ( id, name, function ),
           roadmap_entries ( id, stage )`,
        )
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GovernanceFlagRow[];
    },
  });

export interface GovernanceAuditEntry {
  id: string;
  action_type: string;
  actor_id: string | null;
  before_state: unknown;
  after_state: unknown;
  metadata: unknown;
  created_at: string;
}

export const governanceFlagAuditQO = (
  flagId: string | undefined,
  workspaceId: string | undefined,
  isAdmin: boolean,
) =>
  queryOptions({
    enabled: !!flagId && !!workspaceId,
    queryKey: ["scale", "governance_flag_audit", flagId, workspaceId, isAdmin],
    queryFn: async (): Promise<GovernanceAuditEntry[]> => {
      if (isAdmin) {
        // Admins get diffs via SECURITY DEFINER RPC; direct column SELECT is revoked.
        const { data, error } = await supabase.rpc("get_audit_log_with_diffs", {
          p_workspace_id: workspaceId!,
          p_limit: 2000,
        });
        if (error) throw error;
        return ((data ?? []) as Array<{
          id: string;
          action_type: string;
          actor_id: string | null;
          entity_type: string;
          entity_id: string | null;
          before_state: unknown;
          after_state: unknown;
          metadata: unknown;
          created_at: string;
        }>)
          .filter((r) => r.entity_type === "governance_flag" && r.entity_id === flagId)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((r) => ({
            id: r.id,
            action_type: r.action_type,
            actor_id: r.actor_id,
            before_state: r.before_state,
            after_state: r.after_state,
            metadata: r.metadata,
            created_at: r.created_at,
          }));
      }
      // Members read only the safe (non-revoked) columns.
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action_type, actor_id, metadata, created_at")
        .eq("entity_type", "governance_flag")
        .eq("entity_id", flagId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...(r as Omit<GovernanceAuditEntry, "before_state" | "after_state">),
        before_state: null,
        after_state: null,
      }));
    },
  });
