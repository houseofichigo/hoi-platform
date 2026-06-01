import type { PrototypeSurface } from "@/lib/worked-examples/invoice-ocr/m05";

interface PrototypeSurfaceMapProps {
  surfaces: readonly PrototypeSurface[];
}

export function PrototypeSurfaceMap({ surfaces }: PrototypeSurfaceMapProps) {
  return (
    <ul className="space-y-3">
      {surfaces.map((s) => (
        <li
          key={s.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2"
        >
          <header className="flex items-baseline gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              SURFACE 0{s.order}
            </p>
            <p className="font-display text-navy text-base">{s.title}</p>
          </header>
          <p className="text-[13px] text-navy">{s.purpose}</p>
          <div className="space-y-1">
            <p className="eyebrow-muted">MUST SHOW</p>
            <ul className="list-disc pl-5 space-y-0.5 text-[12px] text-slate">
              {s.mustShow.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <p className="eyebrow-muted">SANDBOX RULE</p>
            <p className="text-[12px] italic text-slate">{s.sandboxRule}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
