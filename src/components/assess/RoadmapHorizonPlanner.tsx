import type {
  RoadmapHorizon,
  RoadmapHorizonId,
} from "@/lib/worked-examples/invoice-ocr/m12";

export interface HorizonInitiative {
  id: string;
  label: string;
}

interface Props {
  horizons: readonly RoadmapHorizon[];
  initiatives: Record<RoadmapHorizonId, HorizonInitiative[]>;
  rationale: string;
  onAdd: (horizon: RoadmapHorizonId, label: string) => void;
  onRemove: (horizon: RoadmapHorizonId, id: string) => void;
  onRationaleChange: (value: string) => void;
}

export function RoadmapHorizonPlanner({
  horizons,
  initiatives,
  rationale,
  onAdd,
  onRemove,
  onRationaleChange,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {horizons.map((h) => {
          const list = initiatives[h.id] ?? [];
          return (
            <div key={h.id} className="card space-y-3 border-l-[3px] border-l-terracotta">
              <div>
                <p className="eyebrow-muted">{h.label.toUpperCase()} · {h.timeframe}</p>
                <p className="mt-1 text-[12px] text-slate">{h.purpose}</p>
              </div>
              <ul className="space-y-1">
                {list.length === 0 && (
                  <li className="text-[12px] italic text-slate">No initiatives yet.</li>
                )}
                {list.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-start justify-between gap-2 rounded-md bg-mist/40 p-2 text-[13px] text-navy"
                  >
                    <span>{i.label}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(h.id, i.id)}
                      className="shrink-0 text-[11px] text-slate hover:text-terracotta"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
              <AddInitiative onAdd={(label) => onAdd(h.id, label)} />
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <p className="eyebrow-muted">SEQUENCING RATIONALE</p>
        <textarea
          value={rationale}
          onChange={(e) => onRationaleChange(e.target.value)}
          rows={4}
          placeholder="Why this sequence? Name the capacity, data, or governance constraint that drives it."
          className="w-full rounded-md border border-chalk bg-paper p-3 text-[14px] text-navy outline-none focus:border-terracotta"
        />
        <p className="text-[12px] text-slate">
          {rationale.trim().length} characters · target {">"} 80
        </p>
      </div>
    </div>
  );
}

function AddInitiative({ onAdd }: { onAdd: (label: string) => void }) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("label") as HTMLInputElement;
        const v = input.value.trim();
        if (v.length === 0) return;
        onAdd(v);
        input.value = "";
      }}
    >
      <input
        name="label"
        placeholder="Add initiative…"
        className="flex-1 rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
      />
      <button
        type="submit"
        className="rounded-md border border-chalk px-3 text-[12px] font-medium text-navy hover:border-terracotta hover:text-terracotta"
      >
        +
      </button>
    </form>
  );
}
