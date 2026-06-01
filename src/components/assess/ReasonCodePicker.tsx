import type { ReasonCode } from "@/lib/worked-examples/invoice-ocr/m09";

interface Props {
  codes: readonly ReasonCode[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function ReasonCodePicker({ codes, selected, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map((c) => {
        const isSelected = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            title={c.meaning}
            className={`rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors ${
              isSelected
                ? "bg-terracotta text-white"
                : "bg-mist text-slate hover:bg-mist/70"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
