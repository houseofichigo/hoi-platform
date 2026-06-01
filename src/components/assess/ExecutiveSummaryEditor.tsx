interface NextPilotCriterion {
  id: string;
  label: string;
  detail: string;
}

interface Props {
  summary: string;
  onSummaryChange: (value: string) => void;
  criteria: readonly NextPilotCriterion[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  acknowledged: boolean;
  onAcknowledge: (next: boolean) => void;
}

export function ExecutiveSummaryEditor({
  summary,
  onSummaryChange,
  criteria,
  selected,
  onToggle,
  acknowledged,
  onAcknowledge,
}: Props) {
  const selectedCount = criteria.filter((c) => selected[c.id]).length;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="eyebrow-muted">GENERATED EXECUTIVE SUMMARY (SPONSOR-READY)</p>
        <div className="card whitespace-pre-wrap bg-mist/40 font-mono text-[12px] leading-relaxed text-navy">
          {summary}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] text-navy">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            className="h-4 w-4 accent-terracotta"
          />
          I've reviewed this summary and confirm it's accurate for the sponsor.
        </label>
        <details className="group rounded-md border border-chalk bg-paper">
          <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
            Advanced — edit the generated summary (optional)
          </summary>
          <div className="space-y-1 p-3 pt-0">
            <textarea
              value={summary}
              onChange={(e) => onSummaryChange(e.target.value)}
              rows={14}
              className="w-full rounded-md border border-chalk bg-paper p-3 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
            />
            <p className="text-[12px] text-slate">Optional. Your edits are saved automatically.</p>
          </div>
        </details>
      </div>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow-muted">NEXT PILOT GO/NO-GO CRITERIA</p>
          <span className="font-mono text-[11px] text-slate">
            {selectedCount} selected · target ≥ 3
          </span>
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
    </div>
  );
}
