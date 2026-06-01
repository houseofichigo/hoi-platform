import type { AgentRequirementCard } from "@/lib/worked-examples/invoice-ocr/m05";

interface AgentRequirementCardsProps {
  cards: readonly AgentRequirementCard[];
}

export function AgentRequirementCards({ cards }: AgentRequirementCardsProps) {
  return (
    <ul className="space-y-3">
      {cards.map((c) => (
        <li
          key={c.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-3"
        >
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              REQUIREMENT · {c.id.toUpperCase().replace(/_/g, " ")}
            </p>
            <p className="font-display text-navy text-base">{c.title}</p>
          </header>
          <dl className="grid grid-cols-1 gap-y-2 text-[12px]">
            <div>
              <dt className="eyebrow-muted">PROTOTYPE FAKES</dt>
              <dd className="text-navy">{c.prototypeFake}</dd>
            </div>
            <div>
              <dt className="eyebrow-muted">REAL AGENT MUST</dt>
              <dd className="text-navy">{c.realAgentMust}</dd>
            </div>
            <div>
              <dt className="eyebrow-muted">RISK IF IGNORED</dt>
              <dd className="text-slate italic">{c.riskIfIgnored}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
