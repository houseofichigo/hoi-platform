import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useRoadmapEntries,
  useMoveRoadmapEntry,
  useUpdateRoadmapEntry,
  useWorkspaceMemberProfiles,
} from "@/hooks/useScaleRoadmap";
import {
  ROADMAP_STAGES,
  STAGE_LABEL,
  type RoadmapEntryWithRelations,
  type RoadmapStage,
} from "@/lib/scale/types";

export const Route = createFileRoute("/app/$workspaceSlug/scale/roadmap")({
  component: RoadmapPage,
});

function RoadmapPage() {
  const { workspace, isAdmin } = useWorkspace();
  const { data: entries = [], isLoading } = useRoadmapEntries();
  const { data: members = [] } = useWorkspaceMemberProfiles();

  const [moveTarget, setMoveTarget] = useState<{
    entry: RoadmapEntryWithRelations;
    toStage: RoadmapStage;
  } | null>(null);

  const byStage = useMemo(() => {
    const g: Record<RoadmapStage, RoadmapEntryWithRelations[]> = {
      backlog: [], pilot: [], production: [], scaling: [], retired: [],
    };
    for (const e of entries) g[e.stage].push(e);
    return g;
  }, [entries]);

  const memberById = useMemo(() => {
    const m = new Map<string, (typeof members)[number]>();
    for (const p of members) m.set(p.user_id, p);
    return m;
  }, [members]);

  if (!workspace) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">SCALE · ROADMAP</p>
          <h2 className="h-display-sm mt-1">
            Deployment <em className="text-terracotta not-italic font-display italic">roadmap.</em>
          </h2>
          <p className="text-[13px] text-graphite mt-1">
            {isAdmin
              ? "Use each card's stage menu to move it. Hard-stop flags block moves; pilot → production requires a recommending review."
              : "Read-only view. Workspace admins move cards through stages."}
          </p>
        </div>
        {!isAdmin && (
          <span className="rounded-full border border-chalk bg-mist px-2 py-0.5 text-[11px] text-navy">
            Read-only
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-[12px] text-slate">Loading roadmap…</p>
      ) : entries.length === 0 ? (
        <div className="card">
          <p className="text-[13px] text-slate">
            No roadmap entries yet. Approve a use case in Build to add it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ROADMAP_STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              entries={byStage[stage]}
              memberById={memberById}
              isAdmin={isAdmin}
              onMove={(entry, toStage) => setMoveTarget({ entry, toStage })}
            />
          ))}
        </div>
      )}

      {moveTarget && (
        <MoveModal
          entry={moveTarget.entry}
          toStage={moveTarget.toStage}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}

function StageColumn({
  stage,
  entries,
  memberById,
  isAdmin,
  onMove,
}: {
  stage: RoadmapStage;
  entries: RoadmapEntryWithRelations[];
  memberById: Map<string, { user_id: string; full_name: string | null; avatar_url: string | null }>;
  isAdmin: boolean;
  onMove: (entry: RoadmapEntryWithRelations, toStage: RoadmapStage) => void;
}) {
  return (
    <div className="card space-y-2 min-h-[120px]">
      <div className="flex items-center justify-between">
        <p className="font-display text-[14px] text-navy">{STAGE_LABEL[stage]}</p>
        <span className="text-[11px] text-slate">{entries.length}</span>
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-[11px] text-slate italic">Empty</p>
        ) : (
          entries.map((e) => (
            <RoadmapCard key={e.id} entry={e} memberById={memberById} isAdmin={isAdmin} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}

function RoadmapCard({
  entry,
  memberById,
  isAdmin,
  onMove,
}: {
  entry: RoadmapEntryWithRelations;
  memberById: Map<string, { user_id: string; full_name: string | null; avatar_url: string | null }>;
  isAdmin: boolean;
  onMove: (entry: RoadmapEntryWithRelations, toStage: RoadmapStage) => void;
}) {
  const { workspace } = useWorkspace();
  const score = entry.use_case_scores[0] ?? null;
  const owner = entry.owner_id ? memberById.get(entry.owner_id) : null;
  const openFlags = entry.governance_flags.filter(
    (f) => f.status === "open" || f.status === "in_progress",
  );
  const riskOpen = openFlags.filter(
    (f) => f.severity === "hard_stop" || f.severity === "requires_action",
  );
  const otherStages = ROADMAP_STAGES.filter((s) => s !== entry.stage);

  return (
    <div className="rounded border border-chalk bg-paper p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2 min-h-[44px]">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-navy truncate">{entry.use_cases?.name ?? "Untitled"}</p>
          <p className="text-[10px] text-slate uppercase tracking-wide">{entry.use_cases?.function ?? ""}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {score?.classification && (
            <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
              {score.classification}
            </span>
          )}
          {riskOpen.length > 0 && (
            <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
              !{riskOpen.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-graphite">
        {score?.quadrant && <span>{score.quadrant}</span>}
        {score?.priority != null && <span>P {Number(score.priority).toFixed(1)}</span>}
        <span className="text-slate">
          {openFlags.length} flag{openFlags.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <label className="space-y-0.5">
          <span className="text-slate uppercase tracking-wide">Owner</span>
          {isAdmin ? (
            <OwnerSelect entry={entry} memberById={memberById} />
          ) : (
            <div className="flex items-center gap-1.5 text-graphite">
              {owner?.avatar_url ? (
                <img src={owner.avatar_url} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <div className="h-5 w-5 rounded-full bg-mist text-[9px] font-medium text-navy grid place-items-center">
                  {(owner?.full_name ?? entry.owner_id ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="truncate">{owner?.full_name ?? (entry.owner_id ? "Member" : "Unassigned")}</span>
            </div>
          )}
        </label>
        <label className="space-y-0.5">
          <span className="text-slate uppercase tracking-wide">Target qtr</span>
          {isAdmin ? (
            <QuarterSelect entry={entry} />
          ) : (
            <span className="text-graphite">{entry.target_quarter ?? "—"}</span>
          )}
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 min-h-[24px]">
        {isAdmin ? (
          <select
            aria-label="Change stage"
            title="Change stage"
            className="rounded border border-chalk bg-paper px-1.5 py-0.5 text-[11px] text-navy hover:bg-mist"
            value=""
            onChange={(e) => {
              const v = e.target.value as RoadmapStage;
              if (v) onMove(entry, v);
              e.target.value = "";
            }}
          >
            <option value="">Change stage…</option>
            {otherStages.map((s) => (
              <option key={s} value={s}>
                → {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] text-slate italic">view only</span>
        )}
      </div>

      {entry.stage === "pilot" && workspace && (
        <Link
          to="/app/$workspaceSlug/scale/$useCaseId/review"
          params={{ workspaceSlug: workspace.slug, useCaseId: entry.use_case_id }}
          className="block text-center rounded border border-chalk bg-mist/40 px-2 py-1 text-[11px] font-medium text-navy hover:bg-mist"
        >
          Submit pilot review →
        </Link>
      )}
    </div>
  );
}

function OwnerSelect({
  entry,
  memberById,
}: {
  entry: RoadmapEntryWithRelations;
  memberById: Map<string, { user_id: string; full_name: string | null; avatar_url: string | null }>;
}) {
  const update = useUpdateRoadmapEntry();
  const options = Array.from(memberById.values());
  return (
    <select
      aria-label="Set owner"
      className="w-full rounded border border-chalk bg-paper px-1.5 py-0.5 text-[11px] text-navy hover:bg-mist disabled:opacity-50"
      value={entry.owner_id ?? ""}
      disabled={update.isPending}
      onChange={async (e) => {
        const v = e.target.value;
        const res = await update.mutateAsync({
          entryId: entry.id,
          ownerId: v ? v : null,
        });
        if (!res.ok) toast.error(res.message);
      }}
    >
      <option value="">Unassigned</option>
      {options.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.full_name ?? "Member"}
        </option>
      ))}
    </select>
  );
}

function QuarterSelect({ entry }: { entry: RoadmapEntryWithRelations }) {
  const update = useUpdateRoadmapEntry();
  const options = buildQuarterOptions(entry.target_quarter);
  return (
    <select
      aria-label="Set target quarter"
      className="w-full rounded border border-chalk bg-paper px-1.5 py-0.5 text-[11px] text-navy hover:bg-mist disabled:opacity-50"
      value={entry.target_quarter ?? ""}
      disabled={update.isPending}
      onChange={async (e) => {
        const v = e.target.value;
        const res = await update.mutateAsync({
          entryId: entry.id,
          targetQuarter: v || null,
        });
        if (!res.ok) toast.error(res.message);
      }}
    >
      <option value="">—</option>
      {options.map((q) => (
        <option key={q} value={q}>
          {q}
        </option>
      ))}
    </select>
  );
}

function buildQuarterOptions(current: string | null): string[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startQ = Math.floor(month / 3) + 1;
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const qIdx = startQ - 1 + i;
    const y = year + Math.floor(qIdx / 4);
    const q = (qIdx % 4) + 1;
    out.push(`${y}-Q${q}`);
  }
  if (current && !out.includes(current)) out.unshift(current);
  return out;
}


function MoveModal({
  entry,
  toStage,
  onClose,
}: {
  entry: RoadmapEntryWithRelations;
  toStage: RoadmapStage;
  onClose: () => void;
}) {
  const { workspace } = useWorkspace();
  const move = useMoveRoadmapEntry();
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  const openFlags = entry.governance_flags.filter(
    (f) => f.status === "open" || f.status === "in_progress",
  );
  const hardStops = openFlags.filter((f) => f.severity === "hard_stop");
  const requires = openFlags.filter((f) => f.severity === "requires_action");
  const needsAck = requires.length > 0;
  const blockedHard = hardStops.length > 0;
  const isPromoteToProd = entry.stage === "pilot" && toStage === "production";

  const latestReview = (entry.post_pilot_reviews ?? [])
    .slice()
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))[0] ?? null;
  const reviewBlocksPromotion =
    isPromoteToProd && (!latestReview || latestReview.recommendation !== "promote_to_production");

  const submit = async () => {
    const res = await move.mutateAsync({
      entryId: entry.id,
      toStage,
      reason: reason.trim() || undefined,
      acknowledgedRequiresAction: ack,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Moved to ${STAGE_LABEL[toStage]}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <div className="card max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-[16px] text-navy">
          Move {entry.use_cases?.name ?? "use case"} from {STAGE_LABEL[entry.stage]} to {STAGE_LABEL[toStage]}?
        </h3>

        {blockedHard && (
          <div className="rounded border border-terracotta bg-terracotta/10 p-2 text-[12px] text-navy">
            <p className="font-medium">Resolve hard-stop governance flags before advancing.</p>
            <p className="text-graphite mt-1">{hardStops.length} hard-stop flag(s) open.</p>
          </div>
        )}

        {!blockedHard && reviewBlocksPromotion && (
          <div className="rounded border border-terracotta bg-terracotta/10 p-2 text-[12px] text-navy space-y-1">
            <p className="font-medium">
              {latestReview
                ? "Latest pilot review does not recommend production."
                : "Submit a pilot review before promoting to production."}
            </p>
            {workspace && (
              <Link
                to="/app/$workspaceSlug/scale/$useCaseId/review"
                params={{ workspaceSlug: workspace.slug, useCaseId: entry.use_case_id }}
                className="inline-block text-terracotta hover:underline font-medium"
              >
                Open pilot review →
              </Link>
            )}
          </div>
        )}

        {!blockedHard && needsAck && (
          <div className="rounded border border-navy/30 bg-mist p-2 text-[12px] text-navy">
            <p>{requires.length} governance action(s) still open. You may proceed but must acknowledge.</p>
          </div>
        )}

        {!blockedHard && isPromoteToProd && !reviewBlocksPromotion && (
          <p className="text-[12px] text-graphite">
            Latest pilot review recommends production. You may proceed.
          </p>
        )}


        <label className="block">
          <span className="text-[12px] font-medium text-navy">Reason (optional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-chalk bg-paper px-2 py-1 text-[13px]"
          />
        </label>

        {needsAck && (
          <label className="flex items-center gap-2 text-[12px] text-navy">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            I acknowledge unresolved governance actions.
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={blockedHard || (needsAck && !ack) || move.isPending}
            className="rounded-full bg-terracotta px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {move.isPending ? "Moving…" : "Confirm move"}
          </button>
        </div>
      </div>
    </div>
  );
}
