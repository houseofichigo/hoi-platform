import type { AssistantArchitectureBlock } from "@/lib/worked-examples/invoice-ocr/m04";

interface AssistantArchitectureMapProps {
  blocks: readonly AssistantArchitectureBlock[];
}

export function AssistantArchitectureMap({ blocks }: AssistantArchitectureMapProps) {
  return (
    <ul className="space-y-3">
      {blocks.map((b, i) => (
        <li
          key={b.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              0{i + 1}
            </span>
            <span className="text-sm font-medium text-navy">{b.label}</span>
          </div>
          <p className="text-[13px] text-navy">{b.description}</p>
          <div className="space-y-1">
            <p className="eyebrow-muted">OCR EXAMPLE</p>
            <p className="text-[12px] text-slate">{b.invoiceOcrExample}</p>
          </div>
          <div className="space-y-1">
            <p className="eyebrow-muted">FAILURE IF MISSING</p>
            <p className="text-[12px] italic text-graphite">{b.failureIfMissing}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
