import type { PlaybookRoutine } from "@/lib/worked-examples/invoice-ocr/m10";

interface Props {
  routines: readonly PlaybookRoutine[];
  value: string;
  onChange: (next: string) => void;
  acknowledged: Record<string, boolean>;
  onAck: (id: string, next: boolean) => void;
}

const cadenceColor: Record<PlaybookRoutine["cadence"], string> = {
  Daily: "bg-terracotta/10 text-terracotta",
  Weekly: "bg-navy/10 text-navy",
  Monthly: "bg-slate/10 text-slate",
  Incident: "bg-chalk text-navy",
};

export function PlaybookRoutineList({
  routines,
  value,
  onChange,
  acknowledged,
  onAck,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="card bg-mist/40 space-y-1">
        <p className="eyebrow-muted">GENERATED OPERATING PLAYBOOK</p>
        <p className="text-[13px] text-slate">
          Confirm each routine reflects how your team will actually run this on
          a Monday morning.
        </p>
      </div>
      <div className="space-y-2">
        {routines.map((r) => {
          const checked = acknowledged[r.id] === true;
          return (
            <label
              key={r.id}
              className={`card flex cursor-pointer items-start gap-3 border-l-[3px] ${
                checked ? "border-l-terracotta" : "border-l-chalk"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onAck(r.id, e.target.checked)}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${cadenceColor[r.cadence]}`}
                  >
                    {r.cadence}
                  </span>
                  <span className="text-[13px] font-medium text-navy">{r.title}</span>
                </div>
                <p className="text-[13px] text-navy">
                  <span className="font-medium">Operator: </span>
                  {r.operatorAction}
                </p>
                <p className="text-[12px] text-slate">
                  <span className="font-medium">Escalation: </span>
                  {r.escalationRule}
                </p>
              </div>
            </label>
          );
        })}
      </div>
      <p className="text-[12px] text-slate">
        {routines.filter((r) => acknowledged[r.id]).length} of {routines.length} routines reviewed
      </p>
      <details className="group rounded-md border border-chalk bg-paper">
        <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
          Advanced — edit the generated playbook (optional)
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
