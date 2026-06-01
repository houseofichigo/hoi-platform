import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { AdminNotesPanel } from "@/components/admin/AdminNotesPanel";
import {
  getAdminBilling,
  upsertAdminWorkspaceSubscription,
  type AdminBillingData,
} from "@/lib/admin/admin.functions";
import { useHoiAdmin } from "@/hooks/useHoiAdmin";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBilling,
});

function AdminBilling() {
  const [editing, setEditing] = useState<AdminBillingData["subscriptions"][number] | null>(null);
  const admin = useHoiAdmin();
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
        lead="Manual subscription controls now; Stripe checkout, webhooks, and customer portal can be wired on top of this foundation."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading billing data...</p>
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
                  <th className="px-3 py-3 text-right font-normal">Actions</th>
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
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        disabled={!admin.canManageBilling}
                        onClick={() => setEditing(sub)}
                        className="rounded-full border border-chalk px-3 py-1 text-[11px] text-navy hover:bg-mist disabled:opacity-50"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {editing && data && (
        <SubscriptionDrawer
          subscription={editing}
          plans={data.plans}
          onClose={() => setEditing(null)}
        />
      )}
    </AdminShell>
  );
}

function SubscriptionDrawer({
  subscription,
  plans,
  onClose,
}: {
  subscription: AdminBillingData["subscriptions"][number];
  plans: AdminBillingData["plans"];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertAdminWorkspaceSubscription);
  const [planId, setPlanId] = useState(subscription.plan_id);
  const [status, setStatus] = useState(subscription.status);
  const [stripeCustomerId, setStripeCustomerId] = useState(subscription.stripe_customer_id ?? "");
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState(subscription.stripe_subscription_id ?? "");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(
    subscription.current_period_end ? subscription.current_period_end.slice(0, 10) : "",
  );

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          workspaceId: subscription.workspace_id,
          planId,
          status: status as "manual" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete",
          stripeCustomerId: stripeCustomerId.trim() || null,
          stripeSubscriptionId: stripeSubscriptionId.trim() || null,
          currentPeriodEnd: currentPeriodEnd ? new Date(`${currentPeriodEnd}T00:00:00Z`).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Subscription updated");
      qc.invalidateQueries({ queryKey: ["admin", "billing"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
      onClose();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/35">
      <aside className="h-full w-full max-w-[620px] overflow-y-auto bg-paper p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">BILLING DETAIL</p>
            <h2 className="mt-1 text-[24px] font-semibold text-navy">{subscription.workspace_name}</h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
              {subscription.workspace_id}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-chalk px-3 py-1 text-[12px]">
            Close
          </button>
        </div>

        <section className="mt-5 rounded-md border border-chalk bg-white p-4">
          <p className="eyebrow-muted">Manual subscription</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label>
              <span className="text-[12px] text-slate">Plan</span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="input mt-1">
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[12px] text-slate">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input mt-1">
                <option value="manual">Manual</option>
                <option value="trialing">Trialing</option>
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="canceled">Canceled</option>
                <option value="unpaid">Unpaid</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </label>
            <label>
              <span className="text-[12px] text-slate">Stripe customer ID</span>
              <input value={stripeCustomerId} onChange={(e) => setStripeCustomerId(e.target.value)} className="input mt-1" />
            </label>
            <label>
              <span className="text-[12px] text-slate">Stripe subscription ID</span>
              <input value={stripeSubscriptionId} onChange={(e) => setStripeSubscriptionId(e.target.value)} className="input mt-1" />
            </label>
            <label>
              <span className="text-[12px] text-slate">Current period end</span>
              <input type="date" value={currentPeriodEnd} onChange={(e) => setCurrentPeriodEnd(e.target.value)} className="input mt-1" />
            </label>
          </div>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="btn-ichigo btn-ichigo-primary mt-4 text-[12px] disabled:opacity-50"
          >
            {save.isPending ? "Saving..." : "Save subscription"}
          </button>
        </section>

        <div className="mt-5">
          <AdminNotesPanel entityType="billing" entityId={subscription.workspace_id} />
        </div>
      </aside>
    </div>
  );
}
