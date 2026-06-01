import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getModule, isValidModuleId, type ModuleId } from "@/lib/curriculum";
import { useAssessProgress } from "@/hooks/useAssess";
import { Gate, type GateCriterion } from "@/components/assess/Gate";
import { M04_OCR_CONTENT } from "@/lib/worked-examples/invoice-ocr/m04";
import { M06_OCR_CONTENT } from "@/lib/worked-examples/invoice-ocr/m06";
import { M09_OCR_CONTENT } from "@/lib/worked-examples/invoice-ocr/m09";

export const Route = createFileRoute("/app/$workspaceSlug/assess/$moduleId/gate")({
  component: ModuleGate,
});

function ModuleGate() {
  const { moduleId } = Route.useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const valid = isValidModuleId(moduleId);
  const m = valid ? getModule(moduleId as ModuleId)! : null;

  if (!workspace || !m) return null;
  const slug = workspace.slug;
  const { data: progress } = useAssessProgress(m.id);
  const assignmentComplete = (progress?.status ?? "not_started") === "complete";

  if (!m.gateNumber) {
    return (
      <div className="card border-l-[3px] border-l-terracotta">
        <p className="text-[14px] text-navy">This module has no gate.</p>
      </div>
    );
  }

  // Gate 1 on m04 — wired to M04 readiness criteria
  const isM04Gate1 = m.id === "m04" && m.gateNumber === 1;
  const isM06Gate2 = m.id === "m06" && m.gateNumber === 2;
  const isM09Gate3 = m.id === "m09" && m.gateNumber === 3;

  const criteria: GateCriterion[] = isM04Gate1
    ? M04_OCR_CONTENT.gateReadinessCriteria.map((c) => ({
        id: c.id,
        question: c.question,
        helper: c.label,
      }))
    : isM06Gate2
      ? M06_OCR_CONTENT.gate2Criteria.map((c) => ({
          id: c.id,
          question: c.question,
          helper: c.label,
        }))
      : isM09Gate3
        ? M09_OCR_CONTENT.gate3Criteria.map((c) => ({
            id: c.id,
            question: c.question,
            helper: c.label,
          }))
        : [];

  return (
    <div className="space-y-8">
      {!assignmentComplete && (
        <div className="rounded-md border border-chalk bg-mist/40 px-4 py-3 text-[13px] text-navy flex items-center justify-between gap-4">
          <span>Tip: finish the assignment before recording this gate decision.</span>
          <Link
            to="/app/$workspaceSlug/assess/$moduleId/work"
            params={{ workspaceSlug: slug, moduleId: m.id }}
            className="font-medium text-terracotta hover:opacity-80 whitespace-nowrap"
          >
            Open Assignment →
          </Link>
        </div>
      )}


      {isM04Gate1 ? (
        <Gate
          gateNumber={1}
          moduleId="m04"
          title="Is the assistant safe and useful enough to build the prototype layer on?"
          intro="Use the M04 readiness dossier. Answer each criterion against the dossier — not from memory."
          criteria={criteria}
          synthesis="Continue if value, data, quality, risk, and operability all pass. Continue with constraints if risk or operability are partial and can be named. Improve if quality is partial. Stop if value or data fail."
          nextLabel="Record Gate 1 decision"
          onSaved={() => {
            navigate({
              to: "/app/$workspaceSlug/assess",
              params: { workspaceSlug: slug },
            });
          }}
        />
      ) : isM06Gate2 ? (
        <Gate
          gateNumber={2}
          moduleId="m06"
          title="Is the agent ready to run the controlled pilot — and to expand from it?"
          intro="Use the M06 readiness dossier. Answer each criterion against the dossier — not from memory."
          criteria={criteria}
          synthesis="Continue if goal, permissions, HITL, scope, rollback, auditability, metrics, and residual risk all pass. Continue with constraints if rollback or residual risk are partial and can be named. Improve if HITL coverage or auditability are partial. Stop if goal clarity, tool permissions, or pilot scope fail."
          nextLabel="Record Gate 2 decision"
          onSaved={() => {
            navigate({
              to: "/app/$workspaceSlug/assess",
              params: { workspaceSlug: slug },
            });
          }}
        />
      ) : isM09Gate3 ? (
        <Gate
          gateNumber={3}
          moduleId="m09"
          title="Which use cases earn the next investment cycle?"
          intro="Use the M09 Gate 3 dossier. Answer each criterion against the scored portfolio — not from memory."
          criteria={criteria}
          synthesis="Fund if portfolio value, data, governance, monitoring, ownership, fit, risk acceptance, and rollback all pass. Fund with constraints if governance or monitoring are partial and constraints are enforceable. Defer if a dependency or evidence is missing. Stop if value, risk, or readiness fails."
          nextLabel="Record Gate 3 decision"
          onSaved={() => {
            navigate({
              to: "/app/$workspaceSlug/assess",
              params: { workspaceSlug: slug },
            });
          }}
        />
      ) : (
        <div className="card border-l-[3px] border-l-terracotta">
          <p className="text-[14px] text-navy">
            Gate {m.gateNumber} content is being built. The decision form and criteria will be
            filled in batch 3.{m.num}.
          </p>
        </div>
      )}

      <Link
        to="/app/$workspaceSlug/assess/$moduleId"
        params={{ workspaceSlug: slug, moduleId: m.id }}
        className="inline-block text-[13px] font-medium text-slate hover:text-navy"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
