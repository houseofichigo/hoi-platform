import type { PilotMetric } from "@/lib/worked-examples/invoice-ocr/m06";

interface PilotMetricListProps {
  metrics: readonly PilotMetric[];
}

export function PilotMetricList({ metrics }: PilotMetricListProps) {
  return (
    <ul className="space-y-2">
      {metrics.map((m) => (
        <li
          key={m.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            METRIC · {m.label.toUpperCase()}
          </p>
          <p className="text-[13px] text-navy"><span className="font-medium">Target:</span> {m.target}</p>
          <p className="text-[12px] text-slate"><span className="font-medium">Measurement:</span> {m.measurement}</p>
        </li>
      ))}
    </ul>
  );
}
