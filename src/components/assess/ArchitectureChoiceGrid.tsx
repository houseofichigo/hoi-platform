import type { ArchitectureChoice, ArchitectureChoiceId } from "@/lib/worked-examples/invoice-ocr/m08";

interface Props {
  choices: readonly ArchitectureChoice[];
  value: Record<ArchitectureChoiceId, string>;
  onSelect: (id: ArchitectureChoiceId, option: string) => void;
}

export function ArchitectureChoiceGrid({ choices, value, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {choices.map((c) => (
        <div key={c.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-navy">{c.label}</p>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">
              default · {c.recommendedDefault}
            </p>
          </div>
          <p className="text-[12px] text-slate">{c.decisionQuestion}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {c.options.map((opt) => {
              const selected = value[c.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onSelect(c.id, opt)}
                  className={`rounded-full px-3 py-1 text-[12px] font-mono transition-colors ${
                    selected
                      ? "bg-terracotta text-white"
                      : "bg-mist text-slate hover:bg-mist/70"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
