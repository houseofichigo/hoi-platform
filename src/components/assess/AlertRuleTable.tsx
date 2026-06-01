import type {
  AlertRule,
  AlertTier,
} from "@/lib/worked-examples/invoice-ocr/m11";

export interface AlertRuleState {
  enabled: boolean;
  owner: string;
  escalation: string;
}

interface Props {
  rules: readonly AlertRule[];
  state: Record<string, AlertRuleState>;
  onChange: (id: string, next: AlertRuleState) => void;
}

const tierStyle: Record<AlertTier, string> = {
  info: "bg-mist/60 text-slate",
  warning: "bg-terracotta/10 text-terracotta",
  critical: "bg-terracotta/20 text-terracotta",
  stop: "bg-navy text-paper",
};

export function AlertRuleTable({ rules, state, onChange }: Props) {
  return (
    <div className="space-y-3">
      {rules.map((r) => {
        const s = state[r.id] ?? {
          enabled: false,
          owner: r.owner,
          escalation: r.escalation,
        };
        return (
          <div
            key={r.id}
            className={`card space-y-3 border-l-[3px] ${
              s.enabled ? "border-l-terracotta" : "border-l-chalk"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tierStyle[r.tier]}`}
                  >
                    {r.tier}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                    {r.metricId}
                  </span>
                </div>
                <p className="text-[14px] text-navy">{r.threshold}</p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-navy">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => onChange(r.id, { ...s, enabled: !s.enabled })}
                  className="h-4 w-4 accent-terracotta"
                />
                Enable
              </label>
            </div>
            {s.enabled && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="eyebrow-muted">NAMED OWNER</span>
                  <input
                    type="text"
                    value={s.owner}
                    onChange={(e) => onChange(r.id, { ...s, owner: e.target.value })}
                    placeholder="Named owner (a person, not a team)"
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                  />
                </label>
                <label className="space-y-1">
                  <span className="eyebrow-muted">ESCALATION</span>
                  <input
                    type="text"
                    value={s.escalation}
                    onChange={(e) =>
                      onChange(r.id, { ...s, escalation: e.target.value })
                    }
                    placeholder="Second responder and action"
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
