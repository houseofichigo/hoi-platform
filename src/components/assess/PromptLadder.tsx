import type { PromptLadderRung } from "@/lib/worked-examples/invoice-ocr/m03";

interface PromptLadderProps {
  rungs: readonly PromptLadderRung[];
  /** Initially expanded rung index (default 0 — V1 open). */
  initialOpen?: number;
}

export function PromptLadder({ rungs, initialOpen = 0 }: PromptLadderProps) {
  return (
    <div className="space-y-3">
      {rungs.map((rung, i) => (
        <details
          key={rung.versionLabel}
          open={i === initialOpen}
          className="group rounded-md border border-chalk bg-white overflow-hidden"
        >
          <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-4 py-3 hover:bg-mist/30">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
                {rung.versionLabel}
              </span>
              <span className="font-display text-navy text-base">{rung.headline}</span>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate shrink-0">
              <span className="group-open:hidden">EXPAND →</span>
              <span className="hidden group-open:inline">COLLAPSE ↓</span>
            </span>
          </summary>

          <div className="px-4 pb-4 space-y-4 border-t border-chalk">
            <div className="space-y-1.5 pt-4">
              <div className="eyebrow-muted">PROMPT</div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed bg-ink/95 text-paper rounded-md p-3 overflow-x-auto">
                {rung.promptText}
              </pre>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="eyebrow-muted">WHAT IMPROVED</div>
                <ul className="space-y-1">
                  {rung.whatImproved.map((w) => (
                    <li key={w} className="text-[13px] text-navy leading-relaxed">
                      · {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <div className="eyebrow-muted">WHAT STILL FAILS</div>
                <ul className="space-y-1">
                  {rung.whatStillFails.map((w) => (
                    <li key={w} className="text-[13px] text-slate leading-relaxed">
                      · {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="italic text-[13px] text-slate border-l-2 border-terracotta pl-3">
              {rung.takeaway}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
