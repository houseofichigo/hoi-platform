import { Check, Minus } from "lucide-react";

interface CertificationReadinessProps {
  modulesComplete: number;
  artifactsComplete: number;
  gatesRecorded: number;
}

export function CertificationReadiness({
  modulesComplete,
  artifactsComplete,
  gatesRecorded,
}: CertificationReadinessProps) {
  const tier1Ready = modulesComplete >= 3 && artifactsComplete >= 1;
  const tier2Ready = modulesComplete >= 12 && artifactsComplete >= 4 && gatesRecorded >= 3;

  return (
    <section className="space-y-5">
      <div>
        <p className="eyebrow">CERTIFICATION READINESS</p>
        <h2 className="h-display-sm mt-2 font-display">Tiers</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TierCard
          tier="01"
          title="AI Builder Foundations"
          ready={tier1Ready}
          gaps={[
            { label: "M01–M03 complete", met: modulesComplete >= 3 },
            { label: "Artifact 01 complete", met: artifactsComplete >= 1 },
          ]}
        />
        <TierCard
          tier="02"
          title="Certified AI Systems Builder"
          ready={tier2Ready}
          gaps={[
            { label: "M01–M12 complete", met: modulesComplete >= 12 },
            { label: "All four artifacts complete", met: artifactsComplete >= 4 },
            { label: "All three gates recorded", met: gatesRecorded >= 3 },
          ]}
        />
      </div>
    </section>
  );
}

function TierCard({
  tier,
  title,
  ready,
  gaps,
}: {
  tier: string;
  title: string;
  ready: boolean;
  gaps: Array<{ label: string; met: boolean }>;
}) {
  return (
    <article className="card">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow-muted">TIER {tier}</p>
        {ready ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
            <Check className="h-3 w-3" strokeWidth={3} /> Ready
          </span>
        ) : (
          <span className="rounded-full bg-mist px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
            Not yet
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-[22px] leading-[1.15] text-navy">{title}</h3>
      <ul className="mt-4 space-y-2">
        {gaps.map((g) => (
          <li key={g.label} className="flex items-center gap-2 text-[13px]">
            {g.met ? (
              <Check className="h-3 w-3 text-terracotta" strokeWidth={3} />
            ) : (
              <Minus className="h-3 w-3 text-slate" />
            )}
            <span className={g.met ? "text-navy" : "text-slate"}>{g.label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
