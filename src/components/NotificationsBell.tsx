import { useEffect } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationRow = {
  id: string;
  workspace_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function stageLabel(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function notificationMessage(n: NotificationRow, workspaceName?: string): string {
  const wsLabel = workspaceName ?? "your workspace";
  const p = n.payload ?? {};
  const useCaseName = (p.use_case_name as string | undefined) ?? "A use case";
  switch (n.kind) {
    case "invitation_accepted": {
      const email = (p.accepted_email as string | undefined) ?? "Someone";
      return `${email} accepted your invitation to ${wsLabel}`;
    }
    case "roadmap_added":
      return `${useCaseName} was added to the Scale roadmap.`;
    case "roadmap_stage_changed":
      return `${useCaseName} moved from ${stageLabel(p.from_stage)} to ${stageLabel(p.to_stage)}.`;
    case "roadmap_transition_blocked":
      return `Stage transition blocked: hard-stop governance flags must be resolved on ${useCaseName}.`;
    case "governance_flag_created": {
      const codes = Array.isArray(p.rule_codes) ? (p.rule_codes as string[]) : [];
      const first = codes[0] ?? "A governance flag";
      const extra = codes.length > 1 ? ` (+${codes.length - 1} more)` : "";
      return `${first} flagged on ${useCaseName}${extra}.`;
    }
    case "governance_flag_assigned": {
      const code = (p.rule_code as string | undefined) ?? "A governance flag";
      return `Governance flag ${code} was assigned to you.`;
    }
    case "governance_flag_resolved": {
      const code = (p.rule_code as string | undefined) ?? "A governance flag";
      const status = stageLabel(p.resolution_status);
      return `Governance flag ${code} marked ${status}.`;
    }
    case "post_pilot_review_submitted":
      return `Pilot review submitted for ${useCaseName}.`;
    default:
      return n.kind;
  }
}

function notificationPath(
  n: NotificationRow,
  workspaceSlug?: string,
): { to: string; params: Record<string, string> } | null {
  if (!workspaceSlug) return null;
  const p = n.payload ?? {};
  switch (n.kind) {
    case "roadmap_added":
    case "roadmap_stage_changed":
    case "roadmap_transition_blocked":
      return {
        to: "/app/$workspaceSlug/scale/roadmap",
        params: { workspaceSlug },
      };
    case "governance_flag_created":
    case "governance_flag_assigned":
    case "governance_flag_resolved":
      return {
        to: "/app/$workspaceSlug/scale/governance",
        params: { workspaceSlug },
      };
    case "post_pilot_review_submitted": {
      const ucId = p.use_case_id as string | undefined;
      if (ucId) {
        return {
          to: "/app/$workspaceSlug/scale/$useCaseId/review",
          params: { workspaceSlug, useCaseId: ucId },
        };
      }
      return { to: "/app/$workspaceSlug/scale", params: { workspaceSlug } };
    }
    case "invitation_accepted":
    default:
      return { to: "/app/$workspaceSlug", params: { workspaceSlug } };
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const notifsQuery = useQuery({
    enabled: !!user,
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, workspace_id, kind, payload, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const wsIds = Array.from(new Set(data.map((d) => d.workspace_id).filter(Boolean))) as string[];
      const wsMap: Record<string, { name: string; slug: string }> = {};
      if (wsIds.length) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, name, slug")
          .in("id", wsIds);
        ws?.forEach((w) => {
          wsMap[w.id] = { name: w.name, slug: w.slug };
        });
      }
      return { items: data as NotificationRow[], wsMap };
    },
    refetchInterval: 30_000,
  });

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const items = notifsQuery.data?.items ?? [];
  const wsMap = notifsQuery.data?.wsMap ?? {};
  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-mist"
        >
          <Bell size={18} className="text-slate" />
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread notifications`}
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-terracotta"
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 rounded-lg border-chalk bg-white p-0 shadow-[0_4px_20px_rgba(30,43,77,0.08)]"
      >
        <div className="flex items-center justify-between border-b border-chalk px-4 py-3">
          <span className="text-[14px] font-medium text-navy">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-[12px] text-azure hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] italic text-slate">No notifications yet</p>
          ) : (
            items.map((n) => {
              const ws = n.workspace_id ? wsMap[n.workspace_id] : undefined;
              const msg = notificationMessage(n, ws?.name);
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read_at) markRead.mutate(n.id);
                    const path = notificationPath(n, ws?.slug);
                    if (path) {
                      navigate({ to: path.to, params: path.params } as never);
                    }
                  }}
                  className={`flex w-full flex-col items-start gap-1 border-b border-chalk px-4 py-3 text-left transition-colors hover:bg-mist ${
                    n.read_at ? "" : "bg-mist/40"
                  }`}
                >
                  <span className="text-[13px] text-navy">{msg}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate">
                    {relativeTime(n.created_at)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
