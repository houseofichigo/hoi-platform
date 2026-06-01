import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getWorkspaceAdminOverview } from "@/lib/workspace-admin.functions";

export const Route = createFileRoute("/app/$workspaceSlug/admin/analytics")({
  component: WorkspaceAdminAnalyticsPage,
});

function WorkspaceAdminAnalyticsPage() {
  const { workspace } = useWorkspace();
  const getOverview = useServerFn(getWorkspaceAdminOverview);
  const { data, isLoading, error } = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-admin", "overview", workspace?.id],
    queryFn: () => getOverview({ data: { workspaceId: workspace!.id } }),
  });

  if (!workspace) return null;
  if (isLoading) return <p className="text-[13px] text-slate">Loading analytics...</p>;
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
        {(error as Error).message}
      </p>
    );
  }
  if (!data) return null;

  const assessPct = data.counts.assessTotal
    ? Math.round((data.counts.assessComplete / data.counts.assessTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnalyticsCard title="Assess completion" value={`${assessPct}%`} detail={`${data.counts.assessComplete} of ${data.counts.assessTotal} modules complete`} />
        <AnalyticsCard title="Use cases captured" value={data.counts.useCases} detail={`${data.counts.scoredUseCases} scored and ${data.counts.approvedUseCases} approved`} />
        <AnalyticsCard title="Scale work" value={data.counts.activeRoadmap} detail={`${data.counts.openGovernanceFlags} open governance flags`} />
      </section>

      <section className="rounded-md border border-chalk bg-white p-5">
        <p className="eyebrow-muted">Operational attention</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <AttentionRow
            label="Pending invitations"
            value={data.counts.pendingInvites}
            to="/app/$workspaceSlug/admin/members"
            slug={workspace.slug}
          />
          <AttentionRow
            label="Pending pilot reviews"
            value={data.counts.pendingPilotReviews}
            to="/app/$workspaceSlug/scale/reviews"
            slug={workspace.slug}
          />
          <AttentionRow
            label="Open governance flags"
            value={data.counts.openGovernanceFlags}
            to="/app/$workspaceSlug/scale/governance"
            slug={workspace.slug}
          />
          <AttentionRow
            label="Approved Build use cases"
            value={data.counts.approvedUseCases}
            to="/app/$workspaceSlug/build/library"
            slug={workspace.slug}
          />
        </div>
      </section>
    </div>
  );
}

function AnalyticsCard({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md border border-chalk bg-white p-5">
      <p className="eyebrow-muted">{title}</p>
      <p className="mt-3 text-[34px] font-semibold leading-none text-navy">{value}</p>
      <p className="mt-2 text-[13px] text-graphite">{detail}</p>
    </div>
  );
}

function AttentionRow({
  label,
  value,
  to,
  slug,
}: {
  label: string;
  value: number;
  to:
    | "/app/$workspaceSlug/admin/members"
    | "/app/$workspaceSlug/scale/reviews"
    | "/app/$workspaceSlug/scale/governance"
    | "/app/$workspaceSlug/build/library";
  slug: string;
}) {
  return (
    <Link to={to} params={{ workspaceSlug: slug }} className="flex items-center justify-between rounded-md bg-mist px-4 py-3 hover:bg-chalk">
      <span className="text-[13px] text-navy">{label}</span>
      <span className="rounded-full bg-white px-2.5 py-1 text-[12px] text-slate">{value}</span>
    </Link>
  );
}
