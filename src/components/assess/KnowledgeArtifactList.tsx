import type { KnowledgeArtifact } from "@/lib/worked-examples/invoice-ocr/m04";

interface KnowledgeArtifactListProps {
  artifacts: readonly KnowledgeArtifact[];
}

export function KnowledgeArtifactList({ artifacts }: KnowledgeArtifactListProps) {
  return (
    <ul className="space-y-3">
      {artifacts.map((a) => (
        <li
          key={a.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-3"
        >
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              ARTIFACT 0{a.order} · {a.layer}
            </p>
            <p className="font-display text-navy text-base">{a.title}</p>
          </header>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
            <div>
              <dt className="eyebrow-muted">SOURCE PROMPT</dt>
              <dd className="text-navy">{a.sourcePrompt}</dd>
            </div>
            <div>
              <dt className="eyebrow-muted">EXPECTED FORMAT</dt>
              <dd className="text-navy">{a.expectedFormat}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="eyebrow-muted">ASSISTANT USE</dt>
              <dd className="text-navy">{a.assistantUse}</dd>
            </div>
          </dl>

          <div className="space-y-1">
            <p className="eyebrow-muted">QUALITY CHECKS</p>
            <ul className="list-disc pl-5 space-y-0.5 text-[12px] text-slate">
              {a.qualityChecks.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
