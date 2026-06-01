interface Criterion {
  id: string;
  label: string;
  detail: string;
}

interface Props {
  criteria: readonly Criterion[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function RescoringCriteriaList({ criteria, selected, onToggle }: Props) {
  const count = criteria.filter((c) => selected[c.id]).length;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow-muted">RE-SCORING TRIGGERS</p>
        <span className="font-mono text-[11px] text-slate">{count} selected · target ≥ 3</span>
      </div>
      <div className="space-y-2">
        {criteria.map((c) => {
          const isSelected = selected[c.id] === true;
          return (
            <label
              key={c.id}
              className={`card flex cursor-pointer items-start gap-3 border-l-[3px] ${
                isSelected ? "border-l-terracotta" : "border-l-chalk"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(c.id)}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              <div>
                <p className="text-[14px] font-medium text-navy">{c.label}</p>
                <p className="text-[12px] text-slate">{c.detail}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
