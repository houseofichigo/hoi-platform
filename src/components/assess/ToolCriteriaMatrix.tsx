import type { ToolCriterion } from "@/lib/worked-examples/invoice-ocr/m07";

interface Props {
  criteria: readonly ToolCriterion[];
}

export function ToolCriteriaMatrix({ criteria }: Props) {
  return (
    <div className="rounded-md border border-chalk bg-white">
      <table className="w-full text-[13px] text-navy">
        <thead className="bg-mist/60 text-left">
          <tr>
            <th className="px-3 py-2 font-medium w-40">Criterion</th>
            <th className="px-3 py-2 font-medium">Question</th>
            <th className="px-3 py-2 font-medium">Production risk</th>
            <th className="px-3 py-2 font-medium">Evidence to collect</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.id} className="border-t border-chalk align-top">
              <td className="px-3 py-2 font-medium">{c.label}</td>
              <td className="px-3 py-2 text-slate">{c.question}</td>
              <td className="px-3 py-2 text-slate">{c.productionRisk}</td>
              <td className="px-3 py-2 text-slate">{c.evidenceToCollect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
