import type { IntegrationPlanItem } from "@/lib/worked-examples/invoice-ocr/m06";

interface IntegrationPlanTableProps {
  integrations: readonly IntegrationPlanItem[];
}

export function IntegrationPlanTable({ integrations }: IntegrationPlanTableProps) {
  return (
    <ul className="space-y-2">
      {integrations.map((i) => (
        <li
          key={i.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            INTEGRATION · {i.system.toUpperCase()}
          </p>
          <p className="text-[13px] text-navy">{i.toolPurpose}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
            <div>
              <p className="eyebrow-muted">ALLOWED</p>
              <ul className="list-disc pl-5 text-slate">
                {i.allowedActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow-muted">FORBIDDEN</p>
              <ul className="list-disc pl-5 text-slate">
                {i.forbiddenActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-[12px] italic text-slate">
            <span className="font-medium">Logging:</span> {i.loggingRequired}
          </p>
        </li>
      ))}
    </ul>
  );
}
