import type { CostCategory, CostCategoryId } from "@/lib/worked-examples/invoice-ocr/m08";

export interface CostRow {
  volume: number;
  unitCost: number;
  notes: string;
}

interface Props {
  categories: readonly CostCategory[];
  value: Record<CostCategoryId, CostRow>;
  onChange: (id: CostCategoryId, row: CostRow) => void;
}

export function CostModelTable({ categories, value, onChange }: Props) {
  const totalMonthly = categories.reduce((sum, c) => {
    const row = value[c.id];
    if (!row) return sum;
    return sum + (Number.isFinite(row.volume * row.unitCost) ? row.volume * row.unitCost : 0);
  }, 0);

  return (
    <div className="space-y-3">
      {categories.map((c) => {
        const row = value[c.id] ?? { volume: 0, unitCost: 0, notes: "" };
        const subtotal = row.volume * row.unitCost;
        return (
          <div key={c.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-navy">{c.label}</p>
              <p className="font-mono text-[12px] text-navy">
                {Number.isFinite(subtotal) ? subtotal.toFixed(2) : "—"} /mo
              </p>
            </div>
            <p className="text-[12px] text-slate">{c.driver}</p>
            <p className="text-[11px] text-slate">
              <span className="font-mono uppercase tracking-[0.16em]">method · </span>
              {c.estimationMethod}
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Volume</p>
                <input
                  type="number"
                  min={0}
                  value={row.volume}
                  onChange={(e) =>
                    onChange(c.id, { ...row, volume: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Unit cost</p>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={row.unitCost}
                  onChange={(e) =>
                    onChange(c.id, { ...row, unitCost: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Notes</p>
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => onChange(c.id, { ...row, notes: e.target.value })}
                  placeholder="Assumption, source, or driver"
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="rounded-md border border-chalk bg-mist/40 px-3 py-2 flex items-baseline justify-between">
        <p className="eyebrow-muted">ESTIMATED MONTHLY TOTAL</p>
        <p className="font-mono text-[13px] text-navy">{totalMonthly.toFixed(2)}</p>
      </div>
    </div>
  );
}
