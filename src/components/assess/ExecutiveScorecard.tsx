import type { ExecutiveScorecardMetric } from "@/lib/worked-examples/invoice-ocr/m12";

interface Props {
  metrics: readonly ExecutiveScorecardMetric[];
  selected: Record<string, boolean>;
  targets: Record<string, string>;
  onToggle: (id: string) => void;
  onTargetChange: (id: string, value: string) => void;
}

export function ExecutiveScorecard({
  metrics,
  selected,
  targets,
  onToggle,
  onTargetChange,
}: Props) {
  const selectedCount = metrics.filter((m) => selected[m.id]).length;
  const withTargets = metrics.filter(
    (m) => selected[m.id] && (targets[m.id] ?? "").trim().length > 0,
  ).length;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow-muted">SCORECARD METRICS</p>
        <span className="font-mono text-[11px] text-slate">
          {selectedCount} selected · {withTargets} with target · target ≥ 6
        </span>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => {
          const isSelected = selected[m.id] === true;
          return (
            <div
              key={m.id}
              className={`card space-y-2 border-l-[3px] ${
                isSelected ? "border-l-terracotta" : "border-l-chalk"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-navy">{m.label}</p>
                  <p className="text-[12px] text-slate">{m.whyItMatters}</p>
                  <p className="text-[12px] italic text-slate">
                    Suggested: {m.suggestedTarget}
                  </p>
                </div>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-navy">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(m.id)}
                    className="h-4 w-4 accent-terracotta"
                  />
                  Include
                </label>
              </div>
              {isSelected && (
                <input
                  type="text"
                  value={targets[m.id] ?? ""}
                  onChange={(e) => onTargetChange(m.id, e.target.value)}
                  placeholder="Your target for this metric"
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
