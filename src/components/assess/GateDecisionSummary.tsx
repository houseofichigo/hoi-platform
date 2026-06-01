import { Link } from "@tanstack/react-router";
import { Check, AlertTriangle } from "lucide-react";
import { GATES } from "@/lib/assess/completion";
import type { ModuleId } from "@/lib/curriculum";

interface GateDecisionSummaryProps {
  decisions: Array<{
    gate_number: number;
    module_id: string;
    decision: string;
    justification: string;
    constraints: string[];
    rationales: string[];
  }>;
  workspaceSlug: string;
}

export function GateDecisionSummary({ decisions, workspaceSlug }: GateDecisionSummaryProps) {
  return (
    <section className="space-y-5">
      <div>
        <p className="eyebrow">GOVERNANCE</p>
        <h2 className="h-display-sm mt-2 font-display">Gate decisions</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {GATES.map((g) => {
          const d = decisions.find((x) => x.gate_number === g.num);
          const recorded = !!d;
          return (
            <article key={g.num} className="card">
              <div className="flex items-start justify-between gap-2">
                <p className="eyebrow-muted">
                  GATE {g.num} · {g.moduleId.toUpperCase()} · {g.formal ? "FORMAL" : "INFORMAL"}
                </p>
                {recorded ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} /> Recorded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                    <AlertTriangle className="h-3 w-3" /> Missing
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-display text-[20px] leading-[1.15] text-navy">{g.question}</h3>
              {recorded ? (
                <>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-terracotta">
                    Decision · {d!.decision}
                  </p>
                  <p className="mt-2 line-clamp-3 text-[13px] text-graphite">{d!.justification}</p>
                  <p className="mt-3 text-[12px] text-slate">
                    {d!.rationales.length} rationale{d!.rationales.length === 1 ? "" : "s"} ·{" "}
                    {d!.constraints.length} constraint{d!.constraints.length === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] text-graphite">
                  Record this gate decision to complete the governance chain.
                </p>
              )}
              <Link
                to="/app/$workspaceSlug/assess/$moduleId/gate"
                params={{ workspaceSlug, moduleId: g.moduleId as ModuleId }}
                className="mt-4 inline-block text-[13px] font-medium text-terracotta hover:opacity-80"
              >
                {recorded ? "Review gate →" : "Open gate →"}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
