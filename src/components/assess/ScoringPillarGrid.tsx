import type { PillarId, ScoringPillar } from "@/lib/worked-examples/invoice-ocr/m09";

interface Props {
  pillars: readonly ScoringPillar[];
  value: Record<PillarId, number>;
  onChange: (id: PillarId, score: number) => void;
}

export function ScoringPillarGrid({ pillars, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      {pillars.map((p) => (
        <div
          key={p.id}
          className="rounded-md border border-chalk bg-white px-3 py-2 space-y-1"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-navy">{p.label}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const selected = value[p.id] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange(p.id, n)}
                    className={`h-7 w-7 rounded-md font-mono text-[11px] transition-colors ${
                      selected
                        ? "bg-terracotta text-white"
                        : "bg-mist text-slate hover:bg-mist/70"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[12px] text-slate">{p.question}</p>
        </div>
      ))}
    </div>
  );
}
