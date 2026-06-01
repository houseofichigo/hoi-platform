import type {
  AutomationLevel,
  AutomationStepTemplate,
} from "@/lib/worked-examples/invoice-ocr/m09";

export interface AutomationMapEntry {
  level: AutomationLevel | "";
  humanControl: string;
}

interface Props {
  steps: readonly AutomationStepTemplate[];
  value: Record<string, AutomationMapEntry>;
  onChange: (stepId: string, entry: AutomationMapEntry) => void;
}

const LEVELS: readonly { value: AutomationLevel; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "assist", label: "Assist" },
  { value: "automate", label: "Automate" },
  { value: "forbidden", label: "Forbidden" },
];

const LEVEL_STYLE: Record<AutomationLevel, string> = {
  manual: "bg-navy text-white",
  assist: "bg-terracotta text-white",
  automate: "bg-graphite text-white",
  forbidden: "bg-black text-white",
};

export function AutomationMapEditor({ steps, value, onChange }: Props) {
  return (
    <div className="space-y-3">
      {steps.map((s) => {
        const entry = value[s.id] ?? { level: "", humanControl: "" };
        return (
          <div key={s.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-navy">{s.label}</p>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">
                default · {s.recommendedLevel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((opt) => {
                const selected = entry.level === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(s.id, { ...entry, level: opt.value })}
                    className={`rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors ${
                      selected ? LEVEL_STYLE[opt.value] : "bg-mist text-slate hover:bg-mist/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">
                Human control
              </p>
              <input
                type="text"
                value={entry.humanControl}
                onChange={(e) => onChange(s.id, { ...entry, humanControl: e.target.value })}
                placeholder={s.humanControl}
                className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
