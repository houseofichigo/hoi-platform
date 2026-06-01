import type { HitlCheckpoint } from "@/lib/worked-examples/invoice-ocr/m06";

interface HITLCheckpointMatrixProps {
  checkpoints: readonly HitlCheckpoint[];
}

export function HITLCheckpointMatrix({ checkpoints }: HITLCheckpointMatrixProps) {
  return (
    <ul className="space-y-2">
      {checkpoints.map((c) => (
        <li
          key={c.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            CHECKPOINT · {c.id.toUpperCase().replace(/_/g, " ")}
          </p>
          <p className="text-[13px] text-navy"><span className="font-medium">Trigger:</span> {c.trigger}</p>
          <p className="text-[12px] text-slate"><span className="font-medium">Agent must:</span> {c.agentMustDo}</p>
          <p className="text-[12px] text-slate"><span className="font-medium">Human decides:</span> {c.humanMustDecide}</p>
        </li>
      ))}
    </ul>
  );
}
