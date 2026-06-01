import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BarChart3, CreditCard, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getWorkspaceAdminOverview } from "@/lib/workspace-admin.functions";

export const Route = createFileRoute("/app/$workspaceSlug/admin/")({
  component: WorkspaceAdminOverviewPage,
});

function WorkspaceAdminOverviewPage() {
  const { workspace } = useWorkspace();
  const getOverview = useServerFn(getWorkspaceAdminOverview);
  const { data, isLoading, error } = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-admin", "overview", workspace?.id],
    queryFn: () => getOverview({ data: { workspaceId: workspace!.id } }),
  });

  if (!workspace) return null;

  if (isLoading) return <p className="text-[13px] text-slate">Loading workspace admin...</p>;
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
        {(error as Error).message}
      </p>
    );
  }
  if (!data) return null;
  const seatDetail = data.billing.seatUsage.limit
    ? `${data.billing.seatUsage.used}/${data.billing.seatUsage.limit} licences used`
    : `${data.billing.seatUsage.used} active member(s)`;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <AdminMetric
          label="Members"
          value={data.counts.members}
          detail={`${data.counts.pendingInvites} pending invite(s) · ${seatDetail}`}
          warning={data.billing.seatUsage.overLimit}
        />
        <AdminMetric label="Assess progress" value={`${data.counts.assessComplete}/${data.counts.assessTotal}`} detail="completed modules" />
        <AdminMetric label="Build portfolio" value={data.counts.useCases} detail={`${data.counts.scoredUseCases} scored · ${data.counts.approvedUseCases} approved`} />
        <AdminMetric label="Scale attention" value={data.counts.openGovernanceFlags} detail={`${data.counts.pendingPilotReviews} pilot review(s) pending`} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <QuickLink
          icon={Users}
          title="Team management"
          body="Invite members and viewers, monitor pending invites, and see who has access."
          to="/app/$workspaceSlug/admin/members"
          slug={workspace.slug}
        />
        <QuickLink
          icon={BarChart3}
          title="Workspace analytics"
          body="Track Assess completion, scored use cases, active roadmap work, and open governance items."
          to="/app/$workspaceSlug/admin/analytics"
          slug={workspace.slug}
        />
        <QuickLink
          icon={CreditCard}
          title="Billing and seats"
          body="Review plan, licence usage, subscription status, and manual billing notes."
          to="/app/$workspaceSlug/admin/billing"
          slug={workspace.slug}
        />
      </section>

      <section className="rounded-md border border-chalk bg-white p-5">
        <p className="eyebrow-muted">Setup status</p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <SetupSignal label="Company profile" complete={data.onboarding.companyProfileComplete} />
          <SetupSignal label="Use-case profile" complete={data.onboarding.useCaseProfileComplete} />
          <SetupSignal label="Worked example" complete={data.onboarding.workedExampleSelected} />
        </div>
      </section>
    </div>
  );
}

function AdminMetric({ label, value, detail, warning = false }: { label: string; value: string | number; detail: string; warning?: boolean }) {
  return (
    <div className={["rounded-md border bg-white p-4", warning ? "border-amber-300" : "border-chalk"].join(" ")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none text-navy">{value}</p>
      <p className="mt-2 text-[12px] text-graphite">{detail}</p>
      {warning && <p className="mt-2 text-[12px] text-amber-700">Seat usage is above the current licence limit.</p>}
    </div>
  );
}

function QuickLink({
  icon: Icon,
  title,
  body,
  to,
  slug,
}: {
  icon: typeof Users;
  title: string;
  body: string;
  to: "/app/$workspaceSlug/admin/members" | "/app/$workspaceSlug/admin/analytics" | "/app/$workspaceSlug/admin/billing";
  slug: string;
}) {
  return (
    <Link to={to} params={{ workspaceSlug: slug }} className="rounded-md border border-chalk bg-white p-5 hover:border-terracotta">
      <Icon className="h-5 w-5 text-terracotta" />
      <p className="mt-4 text-[15px] font-semibold text-navy">{title}</p>
      <p className="mt-2 text-[13px] text-graphite">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[12px] text-terracotta">
        Open <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

function SetupSignal({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-mist px-3 py-2">
      <span className="text-[13px] text-navy">{label}</span>
      <span className={complete ? "text-[12px] text-emerald-700" : "text-[12px] text-amber-700"}>
        {complete ? "Complete" : "Missing"}
      </span>
    </div>
  );
}
