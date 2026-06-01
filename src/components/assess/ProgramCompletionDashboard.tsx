import { Link } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { ARTIFACTS, GATES, artifactStatus } from "@/lib/assess/completion";
import { MODULES, type ModuleId } from "@/lib/curriculum";
import { ArtifactReadinessPanel } from "./ArtifactReadinessPanel";
import { GateDecisionSummary } from "./GateDecisionSummary";
import { CertificationReadiness } from "./CertificationReadiness";
import type { AssessProgressRow } from "@/hooks/useAssess";

interface Props {
  workspaceSlug: string;
  workspaceName: string;
  progress: Record<string, AssessProgressRow>;
  presentOutputs: Set<string>;
  decisions: Array<{
    gate_number: number;
    module_id: string;
    decision: string;
    justification: string;
    constraints: string[];
    rationales: string[];
  }>;
}

export function ProgramCompletionDashboard({
  workspaceSlug,
  workspaceName,
  progress,
  presentOutputs,
  decisions,
}: Props) {
  const moduleStatusMap: Record<string, "not_started" | "in_progress" | "complete"> = {};
  for (const m of MODULES) {
    moduleStatusMap[m.id] = progress[m.id]?.status ?? "not_started";
  }
  const modulesComplete = MODULES.filter((m) => moduleStatusMap[m.id] === "complete").length;
  const artifactsComplete = ARTIFACTS.filter(
    (a) => artifactStatus(a, progress, presentOutputs) === "complete",
  ).length;
  const gatesRecorded = GATES.filter((g) => decisions.some((d) => d.gate_number === g.num)).length;

  const tier2Ready = modulesComplete >= 12 && artifactsComplete >= 4 && gatesRecorded >= 3;
  const tier =
    tier2Ready
      ? "Tier 02 — Certified AI Systems Builder"
      : modulesComplete >= 3 && artifactsComplete >= 1
        ? "Tier 01 — AI Builder Foundations"
        : "Not yet";

  const checklist = [
    { label: "All modules complete", met: modulesComplete >= 12 },
    { label: "All four artifacts complete", met: artifactsComplete >= 4 },
    { label: "Gate 1 recorded", met: decisions.some((d) => d.gate_number === 1) },
    { label: "Gate 2 recorded", met: decisions.some((d) => d.gate_number === 2) },
    { label: "Gate 3 recorded", met: decisions.some((d) => d.gate_number === 3) },
    { label: "Handoff Pack reviewed", met: artifactStatus(ARTIFACTS[3], progress, presentOutputs) === "complete" },
    { label: "Executive sponsor summary ready", met: presentOutputs.has("m12.executive_summary") },
    { label: "Next pilot cycle selected", met: presentOutputs.has("m12.executive_summary") },
  ];

  return (
    <div className="space-y-14">
      <header>
        <p className="eyebrow">
          <Link
            to="/app/$workspaceSlug/assess"
            params={{ workspaceSlug }}
            className="hover:text-terracotta"
          >
            ← {workspaceName.toUpperCase()} · ASSESS
          </Link>{" "}
          · PROGRAM COMPLETION
        </p>
        <h1 className="h-display-md mt-3 max-w-[24ch]">
          Program <span className="accent-italic">completion.</span>
        </h1>
        <p className="lead mt-3 max-w-[60ch]">
          Review your modules, artifacts, gates, and certification readiness.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Modules complete" value={`${modulesComplete} / 12`} />
        <StatTile label="Artifacts complete" value={`${artifactsComplete} / 4`} />
        <StatTile label="Gates recorded" value={`${gatesRecorded} / 3`} />
        <StatTile label="Certification" value={tier} />
      </section>

      <section className="space-y-5">
        <div>
          <p className="eyebrow">DELIVERABLES</p>
          <h2 className="h-display-sm mt-2 font-display">Artifact readiness</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ARTIFACTS.map((a) => (
            <ArtifactReadinessPanel
              key={a.id}
              artifact={a}
              moduleProgress={moduleStatusMap}
              outputKeys={a.outputKeys}
              presentOutputs={presentOutputs}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      </section>

      <GateDecisionSummary decisions={decisions} workspaceSlug={workspaceSlug} />

      <CertificationReadiness
        modulesComplete={modulesComplete}
        artifactsComplete={artifactsComplete}
        gatesRecorded={gatesRecorded}
      />

      <section className="space-y-5">
        <div>
          <p className="eyebrow">HANDOFF</p>
          <h2 className="h-display-sm mt-2 font-display">Final handoff checklist</h2>
        </div>
        <div className="card">
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[14px]">
                {c.met ? (
                  <Check className="h-4 w-4 text-terracotta" strokeWidth={3} />
                ) : (
                  <Minus className="h-4 w-4 text-slate" />
                )}
                <span className={c.met ? "text-navy" : "text-slate"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="eyebrow-muted">{label}</p>
      <p className="mt-2 font-display text-[24px] leading-[1.1] text-navy">{value}</p>
    </div>
  );
}

// Re-export ModuleId for consumers if needed
export type { ModuleId };
