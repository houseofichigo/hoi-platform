import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getWorkspaceAdminBilling } from "@/lib/workspace-admin.functions";

export const Route = createFileRoute("/app/$workspaceSlug/admin/invoices")({
  component: WorkspaceAdminInvoicesPage,
});

function WorkspaceAdminInvoicesPage() {
  const { workspace } = useWorkspace();
  const getBilling = useServerFn(getWorkspaceAdminBilling);
  const { data, isLoading, error } = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-admin", "billing", workspace?.id],
    queryFn: () => getBilling({ data: { workspaceId: workspace!.id } }),
  });

  if (!workspace) return null;
  if (isLoading) return <p className="text-[13px] text-slate">Loading invoices...</p>;
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
        {(error as Error).message}
      </p>
    );
  }

  return (
    <section className="rounded-md border border-chalk bg-white p-5">
      <p className="eyebrow-muted">Invoices</p>
      <h2 className="mt-2 text-[22px] font-semibold text-navy">Invoice history.</h2>
      <p className="mt-2 max-w-[64ch] text-[13px] text-graphite">
        Stripe invoices will appear here once the customer portal is connected. For now, billing records are managed by House of Ichigo.
      </p>

      <div className="mt-5 overflow-hidden rounded-md border border-chalk">
        {!data?.billingEvents.length ? (
          <p className="p-8 text-center text-[13px] text-slate">No invoice or billing events yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-mist text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
              <tr>
                <th className="px-4 py-3 font-normal">Event</th>
                <th className="px-4 py-3 font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.billingEvents.map((event) => (
                <tr key={event.id} className="border-t border-chalk text-navy">
                  <td className="px-4 py-3">{event.eventType}</td>
                  <td className="px-4 py-3 text-slate">{new Date(event.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
