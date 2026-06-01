import type {
  FrameworkElement,
  PromptAssignment,
  SixElementScaffold,
} from "@/lib/worked-examples/invoice-ocr/m03";

export interface PromptEntryFormValue extends SixElementScaffold {
  injectionRisk: string;
}

interface PromptEntryFormProps {
  assignment: PromptAssignment;
  frameworkElements: readonly FrameworkElement[];
  injectionRisks: readonly string[];
  value: PromptEntryFormValue;
  onChange: (value: PromptEntryFormValue) => void;
  defaultOpen?: boolean;
}

export function PromptEntryForm({
  assignment,
  frameworkElements,
  injectionRisks,
  value,
  onChange,
  defaultOpen,
}: PromptEntryFormProps) {
  const update = (key: keyof SixElementScaffold, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <details
      open={defaultOpen}
      className="group rounded-md border border-chalk bg-white overflow-hidden"
    >
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-4 py-3 hover:bg-mist/30">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
            PROMPT 0{assignment.order} · {assignment.layer}
          </span>
          <span className="font-display text-navy text-base">{assignment.title}</span>
          <span className="text-[12px] text-slate">
            <span className="font-mono uppercase tracking-wider">Task type:</span>{" "}
            {assignment.taskType}
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate shrink-0">
          <span className="group-open:hidden">EXPAND →</span>
          <span className="hidden group-open:inline">COLLAPSE ↓</span>
        </span>
      </summary>

      <div className="px-4 pb-5 pt-4 space-y-5 border-t border-chalk">
        <div className="space-y-1">
          <p className="eyebrow-muted">OUTPUT</p>
          <p className="text-[13px] text-navy">{assignment.output}</p>
        </div>
        <div className="space-y-1">
          <p className="eyebrow-muted">WHY</p>
          <p className="text-[13px] text-slate">{assignment.why}</p>
        </div>

        <div className="space-y-4">
          {frameworkElements.map((el) => (
            <div key={el.key} className="space-y-1.5">
              <label className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  {el.ordinal}
                </span>
                <span className="text-sm font-medium text-navy">{el.label}</span>
                <span className="text-[12px] text-slate">— {el.whatItDoes}</span>
              </label>
              <textarea
                value={value[el.key] ?? ""}
                onChange={(e) => update(el.key, e.target.value)}
                placeholder={el.placeholder}
                className="w-full min-h-[96px] rounded-md border border-chalk bg-paper p-3 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-chalk pt-4">
          <p className="text-sm font-medium text-navy">
            Pick the one prompt-injection risk you'll name in this library entry
          </p>
          <ul className="space-y-2">
            {injectionRisks.map((risk) => (
              <li key={risk}>
                <label className="flex cursor-pointer items-start gap-2 text-[13px] text-navy">
                  <input
                    type="radio"
                    name={`injection-${assignment.id}`}
                    checked={value.injectionRisk === risk}
                    onChange={() => onChange({ ...value, injectionRisk: risk })}
                    className="mt-1 h-4 w-4 accent-terracotta"
                  />
                  <span>{risk}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
