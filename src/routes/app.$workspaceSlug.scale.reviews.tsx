import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { useRoadmapEntries, useWorkspaceMemberProfiles } from "@/hooks/useScaleRoadmap";
import { useWorkspace } from "@/hooks/useWorkspace";
import { STAGE_LABEL } from "@/lib/scale/types";
import type { RoadmapEntryWithRelations } from "@/lib/scale/types";

export const Route = createFileRoute("/app/$workspaceSlug/scale/reviews")({
  component: PilotReviewsIndex,
});

type ReviewItem = {
  entry: RoadmapEntryWithRelations;
  review: RoadmapEntryWithRelations["post_pilot_reviews"][number];
};

function PilotReviewsIndex() {
  const { workspace } = useWorkspace();
  const { data: entries = [], isLoading } = useRoadmapEntries();
  const { data: members = [] } = useWorkspaceMemberProfiles();

  const memberById = useMemo(() => {
    const map = new Map<string, (typeof members)[number]>();
    for (const member of members) map.set(member.user_id, member);
    return map;
  }, [members]);

  const pilotEntries = useMemo(
    () => entries.filter((entry) => entry.stage === "pilot"),
    [entries],
  );

  const pendingReviews = useMemo(
    () => pilotEntries.filter((entry) => entry.post_pilot_reviews.length === 0),
    [pilotEntries],
  );

  const submittedReviews = useMemo(() => {
    const rows: ReviewItem[] = [];
    for (const entry of entries) {
      for (const review of entry.post_pilot_reviews) rows.push({ entry, review });
    }
    return rows.sort(
      (a, b) => Date.parse(b.review.submitted_at) - Date.parse(a.review.submitted_at),
    );
  }, [entries]);

  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">SCALE · PILOT REVIEWS</p>
          <h2 className="h-display-sm mt-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-terracotta" />
            Pilot evidence.
          </h2>
          <p className="mt-1 max-w-[60ch] text-[13px] leading-6 text-graphite">
            Review pilot outcomes before promoting use cases into production. Each review belongs to a specific
            use case, so start from the queue below.
          </p>
        </div>
        <Link
          to="/app/$workspaceSlug/scale/roadmap"
          params={{ workspaceSlug: workspace.slug }}
          className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] font-medium text-navy hover:bg-mist"
        >
          View roadmap
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Pilots active" value={pilotEntries.length} />
        <SummaryCard label="Reviews pending" value={pendingReviews.length} />
        <SummaryCard label="Reviews submitted" value={submittedReviews.length} />
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[16px] text-navy">Pilots needing review</p>
            <p className="mt-1 text-[12px] text-slate">
              A pilot review is required before Pilot to Production can be approved.
            </p>
          </div>
          <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] text-slate">
            {pendingReviews.length} pending
          </span>
        </div>

        {isLoading ? (
          <p className="text-[13px] text-slate">Loading pilot reviews...</p>
        ) : pendingReviews.length === 0 ? (
          <EmptyState
            title="No pilot reviews waiting."
            body={
              pilotEntries.length === 0
                ? "Move an approved use case into Pilot from the roadmap to create a review queue."
                : "Every current pilot has at least one review."
            }
            workspaceSlug={workspace.slug}
          />
        ) : (
          <div className="divide-y divide-chalk">
            {pendingReviews.map((entry) => (
              <PilotReviewRow
                key={entry.id}
                entry={entry}
                ownerName={entry.owner_id ? memberById.get(entry.owner_id)?.full_name ?? null : null}
                workspaceSlug={workspace.slug}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[16px] text-navy">Submitted reviews</p>
            <p className="mt-1 text-[12px] text-slate">
              The latest recommendation controls whether a pilot can move to production.
            </p>
          </div>
          <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] text-slate">
            {submittedReviews.length} submitted
          </span>
        </div>

        {submittedReviews.length === 0 ? (
          <p className="text-[13px] text-slate">No pilot reviews have been submitted yet.</p>
        ) : (
          <div className="divide-y divide-chalk">
            {submittedReviews.map(({ entry, review }) => (
              <div key={review.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-navy">
                    {entry.use_cases?.name ?? "Untitled use case"}
                  </p>
                  <p className="mt-1 text-[12px] text-slate">
                    {recommendationLabel(review.recommendation)} · {new Date(review.submitted_at).toLocaleString()}
                  </p>
                </div>
                <Link
                  to="/app/$workspaceSlug/scale/$useCaseId/review"
                  params={{ workspaceSlug: workspace.slug, useCaseId: entry.use_case_id }}
                  className="rounded-full border border-chalk px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
                >
                  Open review
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PilotReviewRow({
  entry,
  ownerName,
  workspaceSlug,
}: {
  entry: RoadmapEntryWithRelations;
  ownerName: string | null;
  workspaceSlug: string;
}) {
  const score = entry.use_case_scores?.[0];
  const openFlags = entry.governance_flags.filter(
    (flag) => flag.status === "open" || flag.status === "in_progress",
  );

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-navy">
          {entry.use_cases?.name ?? "Untitled use case"}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate">
          <span>{STAGE_LABEL[entry.stage]}</span>
          {ownerName && <span>Owner: {ownerName}</span>}
          {entry.target_quarter && <span>{entry.target_quarter}</span>}
          {score?.classification && <span>{score.classification.replace("_", " ")}</span>}
          {typeof score?.priority === "number" && <span>Priority {Math.round(score.priority)}</span>}
          {openFlags.length > 0 && <span className="text-terracotta">{openFlags.length} open flag{openFlags.length === 1 ? "" : "s"}</span>}
        </div>
      </div>
      <Link
        to="/app/$workspaceSlug/scale/$useCaseId/review"
        params={{ workspaceSlug, useCaseId: entry.use_case_id }}
        className="rounded-full bg-terracotta px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
      >
        Submit review
      </Link>
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <p className="h-display-sm mt-1 text-navy">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  workspaceSlug,
}: {
  title: string;
  body: string;
  workspaceSlug: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-chalk p-6 text-center">
      <p className="font-display text-[16px] text-navy">{title}</p>
      <p className="mx-auto mt-2 max-w-[52ch] text-[13px] leading-6 text-slate">{body}</p>
      <Link
        to="/app/$workspaceSlug/scale/roadmap"
        params={{ workspaceSlug }}
        className="mt-4 inline-flex rounded-full border border-chalk px-3 py-1.5 text-[12px] font-medium text-navy hover:bg-mist"
      >
        Go to roadmap
      </Link>
    </div>
  );
}

function recommendationLabel(value: string | null) {
  switch (value) {
    case "promote_to_production":
      return "Promote to production";
    case "extend_pilot":
      return "Extend pilot";
    case "redesign":
      return "Redesign";
    case "retire":
      return "Retire";
    default:
      return "Recommendation pending";
  }
}
