import type { SystemCardSection } from "@/lib/worked-examples/invoice-ocr/m10";

interface Props {
  sections: readonly SystemCardSection[];
  value: string;
  onChange: (next: string) => void;
  acknowledged: Record<string, boolean>;
  onAck: (id: string, next: boolean) => void;
}

export function SystemCardEditor({
  sections,
  value,
  onChange,
  acknowledged,
  onAck,
}: Props) {
  const allAck = sections.every((s) => acknowledged[s.id]);
  return (
    <div className="space-y-4">
      <div className="card bg-mist/40 space-y-1">
        <p className="eyebrow-muted">GENERATED SYSTEM CARD</p>
        <p className="text-[13px] text-slate">
          We drafted a system card from your worked example. Confirm each
          Article 11 section reads correctly for your context.
        </p>
      </div>
      <div className="space-y-2">
        {sections.map((s) => {
          const checked = acknowledged[s.id] === true;
          return (
            <label
              key={s.id}
              className={`card flex cursor-pointer items-start gap-3 border-l-[3px] ${
                checked ? "border-l-terracotta" : "border-l-chalk"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onAck(s.id, e.target.checked)}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              <div>
                <p className="text-[14px] font-medium text-navy">{s.title}</p>
                <p className="text-[12px] text-slate">{s.prompt}</p>
              </div>
            </label>
          );
        })}
      </div>
      <p className="text-[12px] text-slate">
        {sections.filter((s) => acknowledged[s.id]).length} of {sections.length} sections reviewed
        {allAck ? " — ready to continue" : ""}
      </p>
      <details className="group rounded-md border border-chalk bg-paper">
        <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
          Advanced — edit the generated system card (optional)
        </summary>
        <div className="space-y-1 p-3 pt-0">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={14}
            className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
          />
          <p className="text-[12px] text-slate">Optional. Your edits are saved automatically.</p>
        </div>
      </details>
    </div>
  );
}
