import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminBilling } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBilling,
});

function AdminBilling() {
  const getBilling = useServerFn(getAdminBilling);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => getBilling(),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · BILLING"
        title="Billing readiness."
        lead="Read-only subscription model for now. Stripe checkout, webhooks, and customer portal can be wired on top of this foundation."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading billing data…</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : data ? (
        <div className="space-y-6">
          <section className="rounded-md border border-chalk bg-white p-5">
            <p className="eyebrow-muted">Plans</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {data.plans.map((plan) => (
                <div key={plan.id} className="rounded-md border border-chalk p-4">
                  <p className="text-[15px] font-semibold text-navy">{plan.name}</p>
                  <p className="mt-1 text-[12px] text-slate">ID: {plan.id}</p>
                  <p className="mt-3 text-[13px] text-graphite">
                    Seats: {plan.seat_limit ?? "custom"} · Price:{" "}
                    {plan.monthly_price_cents == null ? "manual" : `$${plan.monthly_price_cents / 100}`}
                  </p>
                  <p className="mt-1 text-[12px] text-slate">
                    Stripe price: {plan.stripe_price_id || "not connected"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-x-auto rounded-md border border-chalk bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-mist text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                <tr>
                  <th className="px-3 py-3 font-normal">Workspace</th>
                  <th className="px-3 py-3 font-normal">Plan</th>
                  <th className="px-3 py-3 font-normal">Status</th>
                  <th className="px-3 py-3 font-normal">Stripe customer</th>
                  <th className="px-3 py-3 font-normal">Period end</th>
                </tr>
              </thead>
              <tbody>
                {data.subscriptions.map((sub) => (
                  <tr key={sub.workspace_id} className="border-t border-chalk text-navy">
                    <td className="px-3 py-3">{sub.workspace_name}</td>
                    <td className="px-3 py-3">{sub.plan_id}</td>
                    <td className="px-3 py-3">{sub.status}</td>
                    <td className="px-3 py-3 text-slate">{sub.stripe_customer_id || "—"}</td>
                    <td className="px-3 py-3 text-slate">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
