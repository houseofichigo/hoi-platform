import type { DocumentationLayer } from "@/lib/worked-examples/invoice-ocr/m10";

interface Props {
  layers: readonly DocumentationLayer[];
  acknowledged: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function DocumentationLayerMap({ layers, acknowledged, onToggle }: Props) {
  return (
    <div className="space-y-3">
      {layers.map((l) => {
        const acked = acknowledged[l.id] === true;
        return (
          <div
            key={l.id}
            className={`card space-y-2 border-l-[3px] ${
              acked ? "border-l-terracotta" : "border-l-chalk"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow-muted">{l.title.toUpperCase()}</p>
                <p className="mt-1 text-[14px] text-navy">{l.purpose}</p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-navy">
                <input
                  type="checkbox"
                  checked={acked}
                  onChange={() => onToggle(l.id)}
                  className="h-4 w-4 accent-terracotta"
                />
                Acknowledge
              </label>
            </div>
            <ul className="list-disc pl-5 text-[13px] text-navy">
              {l.mustInclude.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
