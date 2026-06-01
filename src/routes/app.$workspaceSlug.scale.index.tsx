import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useRoadmapEntries,
  useRecentStageHistory,
  useGovernanceFlagsSummary,
  usePostPilotReviewCounts,
  useAuditMonthCount,
  useWorkspaceMemberProfiles,
} from "@/hooks/useScaleRoadmap";
import { STAGE_LABEL, type RoadmapStage } from "@/lib/scale/types";

export const Route = createFileRoute("/app/$workspaceSlug/scale/")({
  component: ScaleOverview,
});

function ScaleOverview() {
  const { workspace } = useWorkspace();
  const { data: entries = [] } = useRoadmapEntries();
  const { data: flags = [] } = useGovernanceFlagsSummary();
  const { data: history = [] } = useRecentStageHistory(5);
  const { data: reviewCounts } = usePostPilotReviewCounts();
  const { data: auditMonth } = useAuditMonthCount();
  const { data: members = [] } = useWorkspaceMemberProfiles();

  const byStage = useMemo(() => {
    const m: Record<RoadmapStage, number> = {
      backlog: 0, pilot: 0, production: 0, scaling: 0, retired: 0,
    };
    for (const e of entries) m[e.stage] = (m[e.stage] ?? 0) + 1;
    return m;
  }, [entries]);

  const flagSummary = useMemo(() => {
    const open = flags.filter((f) => f.status === "open" || f.status === "in_progress").length;
    const requires = flags.filter(
      (f) => f.severity === "requires_action" && (f.status === "open" || f.status === "in_progress"),
    ).length;
    const resolved = flags.filter((f) => f.status === "resolved").length;
    return { open, requires, resolved };
  }, [flags]);

  const memberById = useMemo(() => {
    const m = new Map<string, (typeof members)[number]>();
    for (const p of members) m.set(p.user_id, p);
    return m;
  }, [members]);

  if (!workspace) return null;

  const cards = [
    {
      label: "Active pipeline",
      value: entries.length,
      sub: `${byStage.backlog} backlog · ${byStage.pilot} pilot · ${byStage.production} prod · ${byStage.scaling} scaling`,
    },
    {
      label: "Governance",
      value: flagSummary.open,
      sub: `${flagSummary.requires} requiring action · ${flagSummary.resolved} resolved`,
    },
    {
      label: "Pilot reviews",
      value: reviewCounts?.submitted ?? 0,
      sub: `${reviewCounts?.pending ?? 0} pending`,
    },
    {
      label: "Audit events this month",
      value: auditMonth ?? 0,
      sub: "across the workspace",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="eyebrow">{c.label}</p>
            <p className="h-display-sm mt-1 text-navy">{c.value}</p>
            <p className="text-[12px] text-slate mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/app/$workspaceSlug/scale/roadmap" params={{ workspaceSlug: workspace.slug }}
          className="rounded-full bg-terracotta px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90">
          View roadmap
        </Link>
        <Link to="/app/$workspaceSlug/scale/governance" params={{ workspaceSlug: workspace.slug }}
          className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] font-medium text-navy hover:bg-mist">
          View governance flags
        </Link>
        <Link to="/app/$workspaceSlug/scale/audit" params={{ workspaceSlug: workspace.slug }}
          className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] font-medium text-navy hover:bg-mist">
          View audit log
        </Link>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-[16px] text-navy">Recent roadmap activity</p>
          <span className="text-[11px] text-slate">last 5 stage changes</span>
        </div>
        {history.length === 0 ? (
          <p className="text-[13px] text-slate">
            No stage changes yet. Approved Build use cases land in Backlog — promote them to Pilot from the roadmap board.
          </p>
        ) : (
          <ul className="divide-y divide-chalk">
            {history.map((h) => {
              const actor = h.changed_by ? memberById.get(h.changed_by) : null;
              const actorName = actor?.full_name ?? (h.changed_by ? h.changed_by.slice(0, 8) : "system");
              return (
                <li key={h.id} className="py-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] text-navy truncate">
                      <span className="font-medium">{h.use_cases?.name ?? "Use case"}</span>{" "}
                      <span className="text-graphite">
                        {h.from_stage ? `${STAGE_LABEL[h.from_stage]} → ` : "added to "}
                        <span className="text-navy">{STAGE_LABEL[h.to_stage]}</span>
                      </span>
                    </p>
                    {h.reason && <p className="text-[11px] text-slate italic mt-0.5">{h.reason}</p>}
                  </div>
                  <p className="text-[11px] text-slate whitespace-nowrap">
                    {actorName} · {new Date(h.changed_at).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
