interface RankRow {
  id: string;
  name: string;
  avgScore: number;
  rank: number;
  constraints: string;
}

interface Props {
  rows: readonly RankRow[];
  onRankChange: (id: string, rank: number) => void;
  onConstraintsChange: (id: string, text: string) => void;
}

export function PortfolioRankingTable({ rows, onRankChange, onConstraintsChange }: Props) {
  return (
    <div className="rounded-md border border-chalk bg-white overflow-x-auto">
      <table className="w-full text-[13px] text-navy">
        <thead className="bg-mist/60 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Candidate</th>
            <th className="px-3 py-2 font-medium w-24">Avg score</th>
            <th className="px-3 py-2 font-medium w-44">Portfolio rank</th>
            <th className="px-3 py-2 font-medium">Constraints (yes-if)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-chalk align-top">
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 font-mono">{r.avgScore.toFixed(2)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((n) => {
                    const selected = r.rank === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onRankChange(r.id, n)}
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
              </td>
              <td className="px-3 py-2">
                <textarea
                  value={r.constraints}
                  onChange={(e) => onConstraintsChange(r.id, e.target.value)}
                  rows={2}
                  placeholder="Residency, HITL, monitoring, ownership, rollback..."
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
