import type {
  CapabilityGap,
  CapabilityGapId,
} from "@/lib/worked-examples/invoice-ocr/m12";

export interface CapabilityGapState {
  notes: string;
  owner: string;
  nextAction: string;
}

interface Props {
  gaps: readonly CapabilityGap[];
  state: Record<CapabilityGapId, CapabilityGapState>;
  onChange: (id: CapabilityGapId, next: CapabilityGapState) => void;
}

export function CapabilityGapMatrix({ gaps, state, onChange }: Props) {
  return (
    <div className="space-y-4">
      {gaps.map((g) => {
        const s = state[g.id] ?? { notes: "", owner: "", nextAction: "" };
        const filled = s.notes.trim().length > 0;
        return (
          <div
            key={g.id}
            className={`card space-y-3 border-l-[3px] ${
              filled ? "border-l-terracotta" : "border-l-chalk"
            }`}
          >
            <div>
              <p className="text-[14px] font-medium text-navy">{g.label}</p>
              <p className="text-[12px] text-slate">{g.question}</p>
              <p className="text-[12px] italic text-slate">e.g. {g.exampleGap}</p>
            </div>
            <textarea
              value={s.notes}
              onChange={(e) => onChange(g.id, { ...s, notes: e.target.value })}
              rows={2}
              placeholder="Gap description"
              className="w-full rounded-md border border-chalk bg-paper p-2 text-[13px] text-navy outline-none focus:border-terracotta"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <input
                type="text"
                value={s.owner}
                onChange={(e) => onChange(g.id, { ...s, owner: e.target.value })}
                placeholder="Named owner"
                className="rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
              />
              <input
                type="text"
                value={s.nextAction}
                onChange={(e) => onChange(g.id, { ...s, nextAction: e.target.value })}
                placeholder="Next action"
                className="rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
