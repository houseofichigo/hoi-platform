import type { OCRBlock } from "@/lib/worked-examples/invoice-ocr/m02";

interface OCRBlockWalkthroughProps {
  block: OCRBlock;
  /** When true, render the governance attributes block under each row. Default true. */
  showGovernance?: boolean;
}

export function OCRBlockWalkthrough({ block, showGovernance = true }: OCRBlockWalkthroughProps) {
  return (
    <div className="space-y-6">
      {block.intro && <p className="text-slate text-sm leading-relaxed">{block.intro}</p>}

      {block.rows.map((row, i) => (
        <div
          key={i}
          className="rounded-md border border-chalk bg-white p-4 space-y-3"
        >
          <h4 className="font-display text-navy text-base">{row.label}</h4>

          <div className="flex flex-wrap gap-2">
            {row.options.map((opt) => {
              const chosen = opt === row.value;
              return (
                <span
                  key={opt}
                  className={
                    chosen
                      ? "inline-flex items-center rounded-full border border-terracotta bg-terracotta/10 text-terracotta px-2.5 py-1 text-xs font-medium"
                      : "inline-flex items-center rounded-full border border-chalk bg-mist/40 text-slate px-2.5 py-1 text-xs line-through"
                  }
                >
                  {opt}
                </span>
              );
            })}
          </div>

          <div className="space-y-1">
            <div className="eyebrow-muted">Why we chose this over the others →</div>
            <p className="text-sm text-graphite leading-relaxed">{row.why}</p>
          </div>

          {showGovernance && row.governance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-chalk">
              <GovItem label="Ownership" value={row.governance.ownership} />
              <GovItem label="Lineage" value={row.governance.lineage} />
              <GovItem label="Quality" value={row.governance.quality} />
              <GovItem label="Access" value={row.governance.access} />
              <div className="md:col-span-2">
                <GovItem label="Privacy" value={row.governance.privacy} />
              </div>
            </div>
          )}
        </div>
      ))}

      {block.computed && (
        <div className="rounded-md border border-navy/20 bg-mist/40 p-4 space-y-1">
          <div className="eyebrow text-navy">{block.computed.label}</div>
          <p className="text-sm text-graphite leading-relaxed">{block.computed.body}</p>
        </div>
      )}
    </div>
  );
}

function GovItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="eyebrow-muted">{label}</div>
      <p className="text-sm text-graphite leading-snug">{value}</p>
    </div>
  );
}
