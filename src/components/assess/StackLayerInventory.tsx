import type { StackLayer } from "@/lib/worked-examples/invoice-ocr/m07";

interface Props {
  layers: readonly StackLayer[];
}

export function StackLayerInventory({ layers }: Props) {
  return (
    <div className="rounded-md border border-chalk bg-white">
      <table className="w-full text-[13px] text-navy">
        <thead className="bg-mist/60 text-left">
          <tr>
            <th className="px-3 py-2 font-medium w-44">Layer</th>
            <th className="px-3 py-2 font-medium">Pilot example</th>
            <th className="px-3 py-2 font-medium">Production question</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((l) => (
            <tr key={l.id} className="border-t border-chalk align-top">
              <td className="px-3 py-2 font-medium">{l.label}</td>
              <td className="px-3 py-2 text-slate">{l.pilotExample}</td>
              <td className="px-3 py-2 text-slate">{l.productionQuestion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
