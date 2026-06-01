import type { AssistantTestCase } from "@/lib/worked-examples/invoice-ocr/m04";

interface AssistantTestCaseListProps {
  cases: readonly AssistantTestCase[];
}

export function AssistantTestCaseList({ cases }: AssistantTestCaseListProps) {
  return (
    <ul className="space-y-3">
      {cases.map((c) => (
        <li
          key={c.id}
          className="rounded-md border border-chalk bg-white px-4 py-3 space-y-3"
        >
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              TEST 0{c.order} · {c.queryType.toUpperCase()}
            </p>
            <p className="font-display text-navy text-base">{c.title}</p>
            <p className="text-[12px] text-slate">{c.purpose}</p>
          </header>

          <div className="space-y-1">
            <p className="eyebrow-muted">STARTER QUERY</p>
            <pre className="whitespace-pre-wrap rounded border border-chalk bg-mist/40 p-3 font-mono text-[12px] leading-relaxed text-navy">
              {c.starterQuery}
            </pre>
          </div>

          <div className="space-y-1">
            <p className="eyebrow-muted">PASS CRITERIA</p>
            <ul className="list-disc pl-5 space-y-0.5 text-[12px] text-navy">
              {c.passCriteria.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
