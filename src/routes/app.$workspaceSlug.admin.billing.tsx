import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getWorkspaceAdminBilling } from "@/lib/workspace-admin.functions";

export const Route = createFileRoute("/app/$workspaceSlug/admin/billing")({
  component: WorkspaceAdminBillingPage,
});

function WorkspaceAdminBillingPage() {
  const { workspace } = useWorkspace();
  const getBilling = useServerFn(getWorkspaceAdminBilling);
  const { data, isLoading, error } = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-admin", "billing", workspace?.id],
    queryFn: () => getBilling({ data: { workspaceId: workspace!.id } }),
  });

  if (!workspace) return null;
  if (isLoading) return <p className="text-[13px] text-slate">Loading billing...</p>;
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
        {(error as Error).message}
      </p>
    );
  }
  if (!data) return null;
  const overLimit = data.seats.limit != null && data.seats.used > data.seats.limit;

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-chalk bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">Billing</p>
            <h2 className="mt-2 text-[24px] font-semibold text-navy">Plan and licences.</h2>
            <p className="mt-2 max-w-[62ch] text-[14px] text-graphite">
              Billing is currently managed by House of Ichigo. Stripe self-service can be connected later without changing this admin surface.
            </p>
          </div>
          <a href="mailto:hello@houseofichigo.com" className="btn-ichigo btn-ichigo-outline text-[13px]">
            Contact HOI
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BillingMetric label="Plan" value={data.subscription.planId} detail={`Workspace display plan: ${data.plan}`} />
        <BillingMetric label="Status" value={data.subscription.status} detail="Manual until Stripe is connected" />
        <BillingMetric
          label="Seats"
          value={data.seats.limit ? `${data.seats.used}/${data.seats.limit}` : `${data.seats.used}`}
          detail={data.seats.limit ? "licences used" : "licence limit managed by HOI"}
          warning={overLimit}
        />
      </section>

      {overLimit && (
        <section className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-[13px] font-medium text-amber-800">Seat limit exceeded</p>
          <p className="mt-1 text-[13px] text-amber-800">
            This workspace has more active members than the current licence limit. Contact House of Ichigo to adjust the plan or seats.
          </p>
        </section>
      )}

      <section className="rounded-md border border-chalk bg-white p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-terracotta" />
          <p className="eyebrow-muted">Subscription detail</p>
        </div>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <BillingFact label="Current period end" value={data.subscription.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString() : "Manual"} />
          <BillingFact label="Invoice history" value={data.billingEvents.length ? `${data.billingEvents.length} event(s)` : "No billing events yet"} />
        </dl>
      </section>
    </div>
  );
}

function BillingMetric({ label, value, detail, warning = false }: { label: string; value: string | number; detail: string; warning?: boolean }) {
  return (
    <div className={["rounded-md border bg-white p-5", warning ? "border-amber-300" : "border-chalk"].join(" ")}>
      <p className="eyebrow-muted">{label}</p>
      <p className="mt-3 text-[28px] font-semibold capitalize text-navy">{value}</p>
      <p className="mt-2 text-[13px] text-graphite">{detail}</p>
    </div>
  );
}

function BillingFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-mist px-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{label}</dt>
      <dd className="mt-1 text-[13px] text-navy">{value}</dd>
    </div>
  );
}
