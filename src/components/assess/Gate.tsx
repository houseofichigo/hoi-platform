import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GATE_CONSTRAINT_OPTIONS, GATE_RATIONALE_OPTIONS } from "@/lib/assess/gate-options";
import { useAssessGateDecision } from "@/hooks/useAssess";
import type { ModuleId } from "@/lib/curriculum";

export type GateDecision = "continue" | "constraints" | "improve" | "stop";

export interface GateCriterion {
  id: string;
  question: string;
  helper?: string;
}

export interface GateProps {
  gateNumber: 1 | 2 | 3;
  moduleId: ModuleId;
  title: string;
  intro?: string;
  criteria?: GateCriterion[];
  synthesis?: string;
  nextLabel?: string;
  onSaved?: () => void;
}

const DECISION_OPTIONS: { value: GateDecision; label: string; description: string }[] = [
  { value: "continue", label: "Continue", description: "Proceed without changes." },
  { value: "constraints", label: "Continue with constraints", description: "Proceed, but with named guardrails." },
  { value: "improve", label: "Improve and retry", description: "Pause, address gaps, re-run the gate." },
  { value: "stop", label: "Stop", description: "Park or kill the use case." },
];

export function Gate({
  gateNumber,
  moduleId,
  title,
  intro,
  criteria = [],
  synthesis,
  nextLabel,
  onSaved,
}: GateProps) {
  const { data: existing, submit } = useAssessGateDecision(gateNumber);

  const [decision, setDecision] = useState<GateDecision>("continue");
  const [justification, setJustification] = useState("");
  const [criteriaResponses, setCriteriaResponses] = useState<Record<string, "yes" | "partial" | "no">>({});
  const [constraints, setConstraints] = useState<string[]>([]);
  const [rationales, setRationales] = useState<string[]>([]);

  useEffect(() => {
    if (existing) {
      setDecision(existing.decision);
      setJustification(existing.justification);
      setCriteriaResponses(existing.criteria_responses ?? {});
      setConstraints(existing.constraints ?? []);
      setRationales(existing.rationales ?? []);
    }
  }, [existing]);

  const toggleArray = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const canSubmit = justification.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Add a short justification to record the decision.");
      return;
    }
    try {
      await submit.mutateAsync({
        module_id: moduleId,
        decision,
        justification: justification.trim(),
        criteria_responses: criteriaResponses,
        constraints,
        rationales,
      });
      toast.success(`Gate ${gateNumber} decision recorded`);
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="eyebrow">GATE {gateNumber} · DECISION</p>
        <h2 className="h-display-sm max-w-[28ch]">{title}</h2>
        {intro && <p className="lead max-w-[60ch]">{intro}</p>}
      </header>

      {criteria.length > 0 && (
        <section className="space-y-3">
          <p className="eyebrow-muted">CRITERIA</p>
          <ul className="space-y-3">
            {criteria.map((c) => (
              <li key={c.id} className="card">
                <p className="text-[14px] font-medium text-navy">{c.question}</p>
                {c.helper && <p className="mt-1 text-[13px] text-graphite">{c.helper}</p>}
                <div className="mt-3 flex gap-2">
                  {(["yes", "partial", "no"] as const).map((v) => {
                    const selected = criteriaResponses[c.id] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCriteriaResponses({ ...criteriaResponses, [c.id]: v })}
                        className={`rounded-full px-3 py-1 text-[12px] font-mono uppercase tracking-[0.16em] transition-colors ${
                          selected
                            ? "bg-terracotta text-white"
                            : "bg-mist text-slate hover:bg-mist/70"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {synthesis && (
        <section className="space-y-2">
          <p className="eyebrow-muted">SYNTHESIS</p>
          <div className="card bg-mist/40 text-[14px] text-navy">{synthesis}</div>
        </section>
      )}

      <section className="space-y-3">
        <p className="eyebrow-muted">DECISION</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DECISION_OPTIONS.map((opt) => {
            const selected = decision === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDecision(opt.value)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  selected
                    ? "border-terracotta bg-terracotta/5"
                    : "border-chalk hover:bg-mist/40"
                }`}
              >
                <p className="text-[14px] font-medium text-navy">{opt.label}</p>
                <p className="mt-1 text-[12px] text-graphite">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {decision === "constraints" && (
        <section className="space-y-2">
          <p className="eyebrow-muted">CONSTRAINTS</p>
          <div className="flex flex-wrap gap-2">
            {GATE_CONSTRAINT_OPTIONS.map((c) => {
              const selected = constraints.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setConstraints(toggleArray(constraints, c.id))}
                  className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
                    selected
                      ? "bg-navy text-white"
                      : "bg-mist text-slate hover:bg-mist/70"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="eyebrow-muted">RATIONALE (OPTIONAL)</p>
        <div className="flex flex-wrap gap-2">
          {GATE_RATIONALE_OPTIONS.map((r) => {
            const selected = rationales.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRationales(toggleArray(rationales, r.id))}
                className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
                  selected ? "bg-navy text-white" : "bg-mist text-slate hover:bg-mist/70"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="eyebrow-muted">JUSTIFICATION</p>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={4}
          placeholder="A few sentences capturing why this decision."
          className="w-full rounded-md border border-chalk bg-white p-3 text-[14px] text-navy outline-none focus:border-terracotta"
        />
      </section>

      <footer className="flex items-center justify-between border-t border-chalk pt-6">
        <span className="text-[12px] italic text-slate">
          {existing ? "Updating a previously recorded decision." : "This decision is per-user, per-workspace."}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submit.isPending}
          className="btn-ichigo btn-ichigo-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nextLabel ?? (existing ? "Update decision" : "Record decision")} →
        </button>
      </footer>
    </article>
  );
}
