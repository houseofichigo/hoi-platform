import type { RagGovernanceDimension } from "@/lib/worked-examples/invoice-ocr/m04";

interface RAGGovernanceCardsProps {
  dimensions: readonly RagGovernanceDimension[];
}

export function RAGGovernanceCards({ dimensions }: RAGGovernanceCardsProps) {
  return (
    <ul className="space-y-3">
      {dimensions.map((d, i) => (
        <li
          key={d.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-3"
        >
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              0{i + 1} · {d.title.toUpperCase()}
            </p>
            <p className="text-sm font-medium text-navy">{d.question}</p>
          </header>

          <p className="text-[12px] text-slate">{d.whyItMatters}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded border border-chalk bg-mist/40 px-3 py-2 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-navy">
                GOOD DEFAULT
              </p>
              <p className="text-[12px] text-navy">{d.goodDefault}</p>
            </div>
            <div className="rounded border border-dashed border-chalk px-3 py-2 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                WEAK DEFAULT
              </p>
              <p className="text-[12px] italic text-graphite">{d.weakDefault}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
