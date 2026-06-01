import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminSupport } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupport,
});

function AdminSupport() {
  const getSupport = useServerFn(getAdminSupport);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "support"],
    queryFn: () => getSupport(),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · SUPPORT"
        title="Support queue."
        lead="Signals for customer-success follow-up: onboarding gaps, pending invites, approvals, and governance flags."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading support queue…</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <article key={`${item.kind}:${item.id}`} className="rounded-md border border-chalk bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                    {item.kind.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-navy">{item.title}</p>
                  <p className="mt-1 text-[13px] text-graphite">{item.detail}</p>
                </div>
                <div className="text-right text-[12px] text-slate">
                  <p>{item.workspace_name || "No workspace"}</p>
                  <p>{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </article>
          ))}
          {data.length === 0 && (
            <div className="rounded-md border border-chalk bg-white p-8 text-center text-[14px] text-slate">
              Nothing needs support attention right now.
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
