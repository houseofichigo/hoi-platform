import type {
  HandoffStage,
  HandoffStageId,
} from "@/lib/worked-examples/invoice-ocr/m10";

export interface HandoffStageNote {
  owner: string;
  backup: string;
  targetDate: string;
}

interface Props {
  stages: readonly HandoffStage[];
  notes: Record<HandoffStageId, HandoffStageNote>;
  onChange: (id: HandoffStageId, next: HandoffStageNote) => void;
}

export function HandoffStagePlan({ stages, notes, onChange }: Props) {
  return (
    <div className="space-y-3">
      {stages.map((s) => {
        const n = notes[s.id] ?? { owner: "", backup: "", targetDate: "" };
        return (
          <div key={s.id} className="card space-y-3">
            <div>
              <p className="eyebrow-muted">{s.title.toUpperCase()}</p>
              <p className="mt-1 text-[13px] text-navy">
                <span className="font-medium">Operator: </span>
                {s.operatorDoes}
              </p>
              <p className="text-[13px] text-navy">
                <span className="font-medium">Builder: </span>
                {s.builderDoes}
              </p>
              <p className="text-[12px] text-slate">
                <span className="font-medium">Exit: </span>
                {s.exitCriteria}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <label className="space-y-1">
                <span className="eyebrow-muted">OWNER</span>
                <input
                  type="text"
                  value={n.owner}
                  onChange={(e) => onChange(s.id, { ...n, owner: e.target.value })}
                  placeholder="Named operator"
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </label>
              <label className="space-y-1">
                <span className="eyebrow-muted">BACKUP</span>
                <input
                  type="text"
                  value={n.backup}
                  onChange={(e) => onChange(s.id, { ...n, backup: e.target.value })}
                  placeholder="Named backup"
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </label>
              <label className="space-y-1">
                <span className="eyebrow-muted">TARGET DATE</span>
                <input
                  type="text"
                  value={n.targetDate}
                  onChange={(e) =>
                    onChange(s.id, { ...n, targetDate: e.target.value })
                  }
                  placeholder="e.g. 2026-Q3 wk 4"
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
