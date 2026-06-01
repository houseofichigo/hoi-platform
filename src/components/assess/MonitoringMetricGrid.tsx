import type {
  MonitoringCategoryId,
  MonitoringMetric,
} from "@/lib/worked-examples/invoice-ocr/m11";

interface Props {
  metrics: readonly MonitoringMetric[];
  selected: Record<string, boolean>;
  owners: Record<string, string>;
  onToggle: (id: string) => void;
  onOwnerChange: (id: string, owner: string) => void;
}

const categoryLabel: Record<MonitoringCategoryId, string> = {
  performance: "Performance",
  accuracy: "Accuracy",
  drift: "Drift",
  fairness: "Fairness",
};

const categoryOrder: readonly MonitoringCategoryId[] = [
  "performance",
  "accuracy",
  "drift",
  "fairness",
];

export function MonitoringMetricGrid({
  metrics,
  selected,
  owners,
  onToggle,
  onOwnerChange,
}: Props) {
  return (
    <div className="space-y-5">
      {categoryOrder.map((cat) => {
        const items = metrics.filter((m) => m.category === cat);
        const count = items.filter((m) => selected[m.id]).length;
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow-muted">{categoryLabel[cat].toUpperCase()}</p>
              <span className="font-mono text-[11px] text-slate">
                {count} selected
              </span>
            </div>
            <div className="space-y-2">
              {items.map((m) => {
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
                        <p className="text-[12px] text-slate">
                          <span className="font-medium">Target: </span>
                          {m.target}
                        </p>
                        <p className="text-[12px] text-slate">{m.whyItMatters}</p>
                      </div>
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-navy">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggle(m.id)}
                          className="h-4 w-4 accent-terracotta"
                        />
                        Track
                      </label>
                    </div>
                    {isSelected && (
                      <input
                        type="text"
                        value={owners[m.id] ?? ""}
                        onChange={(e) => onOwnerChange(m.id, e.target.value)}
                        placeholder="Named owner for this metric"
                        className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
