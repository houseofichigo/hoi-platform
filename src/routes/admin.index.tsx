import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPageHeader, AdminShell, AdminStat } from "@/components/admin/AdminShell";
import { getAdminDashboard } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const getDashboard = useServerFn(getAdminDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => getDashboard(),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · OVERVIEW"
        title="House of Ichigo backend."
        lead="A command centre for customer health, content operations, billing readiness, and platform support."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading admin metrics…</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : data ? (
        <div className="space-y-8">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminStat label="Workspaces" value={data.counts.workspaces} />
            <AdminStat label="Users" value={data.counts.profiles} />
            <AdminStat label="Library items" value={data.counts.libraryItems} />
            <AdminStat label="Paid/manual plans" value={data.counts.paidPlanWorkspaces} />
            <AdminStat label="Content in progress" value={data.counts.contentDrafts} />
            <AdminStat label="Pending invites" value={data.counts.pendingInvites} />
            <AdminStat label="Pending approvals" value={data.counts.pendingApprovals} />
            <AdminStat label="Open governance" value={data.counts.openGovernanceFlags} />
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-md border border-chalk bg-white p-5">
              <p className="eyebrow-muted">Recent workspaces</p>
              <div className="mt-4 divide-y divide-chalk">
                {data.recentWorkspaces.map((ws) => (
                  <div key={ws.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium text-navy">{ws.name}</p>
                      <p className="text-[12px] text-slate">{ws.slug}</p>
                    </div>
                    <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-slate">
                      {ws.plan}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-chalk bg-white p-5">
              <p className="eyebrow-muted">System health</p>
              <div className="mt-4 space-y-3">
                {data.systemHealth.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-navy">{item.label}</p>
                      <p className="text-[12px] text-slate">{item.detail}</p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px]",
                        item.status === "configured"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      ].join(" ")}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
