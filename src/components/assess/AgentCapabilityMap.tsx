import type { AgentCapability } from "@/lib/worked-examples/invoice-ocr/m06";

interface AgentCapabilityMapProps {
  capabilities: readonly AgentCapability[];
}

export function AgentCapabilityMap({ capabilities }: AgentCapabilityMapProps) {
  return (
    <ul className="space-y-2">
      {capabilities.map((c) => (
        <li
          key={c.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            CAPABILITY · {c.title.toUpperCase()}
          </p>
          <p className="text-[13px] text-navy"><span className="font-medium">Goal:</span> {c.goal}</p>
          <p className="text-[12px] text-slate"><span className="font-medium">Boundary:</span> {c.actionBoundary}</p>
          <p className="text-[12px] text-slate"><span className="font-medium">Evidence:</span> {c.evidenceRequired}</p>
        </li>
      ))}
    </ul>
  );
}
