import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAssessProgress, useAssessOutput } from "@/hooks/useAssess";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { useUseCaseProfile } from "@/hooks/useUseCaseProfile";
import { supabase } from "@/integrations/supabase/client";
import { Step } from "@/components/assess/Step";
import { AgentCapabilityMap } from "@/components/assess/AgentCapabilityMap";
import { IntegrationPlanTable } from "@/components/assess/IntegrationPlanTable";
import { HITLCheckpointMatrix } from "@/components/assess/HITLCheckpointMatrix";
import { PilotMetricList } from "@/components/assess/PilotMetricList";
import {
  M06_OCR_CONTENT,
  getM06AgentScaffold,
  type IntegrationId,
  type HitlCheckpointId,
  type PilotMetricId,
} from "@/lib/worked-examples/invoice-ocr/m06";

const CHAPTER_LABEL = "PHASE 02 · M06 · AI AGENTS & PILOT";
const TOTAL_STEPS = 5;

type StepNum = 1 | 2 | 3 | 4 | 5;

const INTEGRATION_IDS: readonly IntegrationId[] = [
  "document_storage",
  "accounting_system",
  "notification",
  "audit_log",
];
const HITL_IDS: readonly HitlCheckpointId[] = [
  "low_confidence",
  "missing_required",
  "policy_conflict",
  "payment_or_sync",
  "exception",
];
const METRIC_IDS: readonly PilotMetricId[] = [
  "accuracy",
  "cycle_time",
  "hitl_rate",
  "exception_rate",
  "audit_completeness",
];

type IntegrationStatus = "mocked" | "read_only" | "write_with_approval" | "deferred" | "";
type HitlSeverity = "required" | "recommended" | "not_applicable" | "";

interface DesignOutput {
  agentGoal: string;
  workflow: string;
  toolPolicy: string;
  memoryPolicy: string;
  pilotScope: string;
}

type IntegrationPlanOutput = Record<IntegrationId, IntegrationStatus>;
type HitlPolicyOutput = Record<HitlCheckpointId, HitlSeverity>;

interface PilotPlanOutput {
  population: string;
  window: string;
  rollbackOwner: string;
  targets: Record<PilotMetricId, string>;
}

interface ReadinessOutput {
  dossierReviewed: boolean;
  gate2Ready: boolean;
}

function buildIntegrationDefaults(): IntegrationPlanOutput {
  return {
    document_storage: "",
    accounting_system: "",
    notification: "",
    audit_log: "",
  };
}
function buildHitlDefaults(): HitlPolicyOutput {
  return {
    low_confidence: "",
    missing_required: "",
    policy_conflict: "",
    payment_or_sync: "",
    exception: "",
  };
}
function buildPilotDefaults(): PilotPlanOutput {
  return {
    population: "",
    window: "",
    rollbackOwner: "",
    targets: {
      accuracy: "",
      cycle_time: "",
      hitl_rate: "",
      exception_rate: "",
      audit_completeness: "",
    },
  };
}

const INTEGRATION_STATUSES: readonly { value: Exclude<IntegrationStatus, "">; label: string }[] = [
  { value: "mocked", label: "Mocked" },
  { value: "read_only", label: "Read-only" },
  { value: "write_with_approval", label: "Write w/ approval" },
  { value: "deferred", label: "Deferred" },
];
const HITL_SEVERITIES: readonly { value: Exclude<HitlSeverity, "">; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "recommended", label: "Recommended" },
  { value: "not_applicable", label: "N/A" },
];

export function M06Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m06");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const designOut = useAssessOutput<DesignOutput>("m06.agent_design");
  const integrationOut = useAssessOutput<IntegrationPlanOutput>("m06.integration_plan");
  const hitlOut = useAssessOutput<HitlPolicyOutput>("m06.hitl_policy");
  const pilotOut = useAssessOutput<PilotPlanOutput>("m06.pilot_plan");
  const readinessOut = useAssessOutput<ReadinessOutput>("m06.readiness");

  const profileContext = useMemo(
    () => ({
      companyName: workspace?.name,
      accountingSoftware: useCaseProfile.data?.accounting_software as string | undefined,
      country: workspaceProfile.data?.country as string | undefined,
      invoiceVolume: useCaseProfile.data?.invoice_volume as string | undefined,
      vatContext: useCaseProfile.data?.vat_context as string | undefined,
    }),
    [workspace?.name, workspaceProfile.data, useCaseProfile.data],
  );

  const scaffold = useMemo(() => getM06AgentScaffold(profileContext), [profileContext]);

  const [step, setStep] = useState<StepNum>(1);
  const [design, setDesign] = useState<DesignOutput>({
    agentGoal: "",
    workflow: "",
    toolPolicy: "",
    memoryPolicy: "",
    pilotScope: "",
  });
  const [integration, setIntegration] = useState<IntegrationPlanOutput>(buildIntegrationDefaults());
  const [hitl, setHitl] = useState<HitlPolicyOutput>(buildHitlDefaults());
  const [pilot, setPilot] = useState<PilotPlanOutput>(buildPilotDefaults());
  const [readiness, setReadiness] = useState<ReadinessOutput>({
    dossierReviewed: false,
    gate2Ready: false,
  });

  const [hydrated, setHydrated] = useState({
    step: false,
    design: false,
    integration: false,
    hitl: false,
    pilot: false,
    readiness: false,
  });

  // Hydrate step
  useEffect(() => {
    if (hydrated.step || progress.isLoading) return;
    const status = progress.data?.status;
    if (status === "complete") {
      setStep(TOTAL_STEPS as StepNum);
    } else {
      const cs = progress.data?.current_step;
      if (cs && cs >= 1 && cs <= TOTAL_STEPS) setStep(cs as StepNum);
    }
    setHydrated((h) => ({ ...h, step: true }));
  }, [hydrated.step, progress.isLoading, progress.data?.current_step, progress.data?.status]);

  // Mark in_progress
  useEffect(() => {
    if (progress.isLoading) return;
    const status = progress.data?.status;
    if (!status || status === "not_started") {
      progress.setStep.mutate(progress.data?.current_step ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.isLoading]);

  // Hydrate design — seed from scaffold if empty
  useEffect(() => {
    if (hydrated.design || designOut.isLoading) return;
    if (designOut.value && typeof designOut.value === "object") {
      const v = designOut.value as Partial<DesignOutput>;
      const seeded: DesignOutput = {
        agentGoal: v.agentGoal && v.agentGoal.length > 0 ? v.agentGoal : scaffold.agentGoal,
        workflow: v.workflow && v.workflow.length > 0 ? v.workflow : scaffold.workflow,
        toolPolicy: v.toolPolicy && v.toolPolicy.length > 0 ? v.toolPolicy : scaffold.toolPolicy,
        memoryPolicy:
          v.memoryPolicy && v.memoryPolicy.length > 0 ? v.memoryPolicy : scaffold.memoryPolicy,
        pilotScope: v.pilotScope && v.pilotScope.length > 0 ? v.pilotScope : scaffold.pilotScope,
      };
      setDesign(seeded);
    } else {
      setDesign({
        agentGoal: scaffold.agentGoal,
        workflow: scaffold.workflow,
        toolPolicy: scaffold.toolPolicy,
        memoryPolicy: scaffold.memoryPolicy,
        pilotScope: scaffold.pilotScope,
      });
    }
    setHydrated((h) => ({ ...h, design: true }));
  }, [hydrated.design, designOut.isLoading, designOut.value, scaffold]);

  // Hydrate integration
  useEffect(() => {
    if (hydrated.integration || integrationOut.isLoading) return;
    if (integrationOut.value && typeof integrationOut.value === "object") {
      const v = integrationOut.value as Partial<IntegrationPlanOutput>;
      const merged = buildIntegrationDefaults();
      for (const id of INTEGRATION_IDS) {
        const val = v[id];
        if (
          val === "mocked" ||
          val === "read_only" ||
          val === "write_with_approval" ||
          val === "deferred"
        ) {
          merged[id] = val;
        }
      }
      setIntegration(merged);
    }
    setHydrated((h) => ({ ...h, integration: true }));
  }, [hydrated.integration, integrationOut.isLoading, integrationOut.value]);

  // Hydrate hitl
  useEffect(() => {
    if (hydrated.hitl || hitlOut.isLoading) return;
    if (hitlOut.value && typeof hitlOut.value === "object") {
      const v = hitlOut.value as Partial<HitlPolicyOutput>;
      const merged = buildHitlDefaults();
      for (const id of HITL_IDS) {
        const val = v[id];
        if (val === "required" || val === "recommended" || val === "not_applicable") {
          merged[id] = val;
        }
      }
      setHitl(merged);
    }
    setHydrated((h) => ({ ...h, hitl: true }));
  }, [hydrated.hitl, hitlOut.isLoading, hitlOut.value]);

  // Hydrate pilot
  useEffect(() => {
    if (hydrated.pilot || pilotOut.isLoading) return;
    if (pilotOut.value && typeof pilotOut.value === "object") {
      const v = pilotOut.value as Partial<PilotPlanOutput>;
      const merged = buildPilotDefaults();
      if (typeof v.population === "string") merged.population = v.population;
      if (typeof v.window === "string") merged.window = v.window;
      if (typeof v.rollbackOwner === "string") merged.rollbackOwner = v.rollbackOwner;
      if (v.targets && typeof v.targets === "object") {
        for (const id of METRIC_IDS) {
          const val = (v.targets as Record<string, unknown>)[id];
          if (typeof val === "string") merged.targets[id] = val;
        }
      }
      setPilot(merged);
    }
    setHydrated((h) => ({ ...h, pilot: true }));
  }, [hydrated.pilot, pilotOut.isLoading, pilotOut.value]);

  // Hydrate readiness
  useEffect(() => {
    if (hydrated.readiness || readinessOut.isLoading) return;
    if (readinessOut.value && typeof readinessOut.value === "object") {
      const v = readinessOut.value as Partial<ReadinessOutput>;
      setReadiness({
        dossierReviewed: !!v.dossierReviewed,
        gate2Ready: !!v.gate2Ready,
      });
    }
    setHydrated((h) => ({ ...h, readiness: true }));
  }, [hydrated.readiness, readinessOut.isLoading, readinessOut.value]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM06 = async () => {
    if (!user || !workspace) return;
    await readinessOut.setValue.mutateAsync(readiness);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m06",
        status: "complete",
        studied: progress.data?.studied ?? false,
        current_step: null,
        max_step_reached: Math.max(progress.data?.max_step_reached ?? 0, TOTAL_STEPS),
        started_at: progress.data?.started_at ?? new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,user_id,module_id" },
    );
    if (error) {
      toast.error("Could not complete M06. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m06"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M06 complete. Gate 2 is ready.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId/gate",
      params: { workspaceSlug: workspace.slug, moduleId: "m06" },
    });
  };

  if (!workspace) return null;

  // ============ STEP 1 — Design ============
  if (step === 1) {
    const s = M06_OCR_CONTENT.step1;
    const allFilled =
      design.agentGoal.trim() !== "" &&
      design.workflow.trim() !== "" &&
      design.toolPolicy.trim() !== "" &&
      design.memoryPolicy.trim() !== "" &&
      design.pilotScope.trim() !== "";

    const fields: { key: keyof DesignOutput; label: string; rows: number }[] = [
      { key: "agentGoal", label: "AGENT GOAL", rows: 3 },
      { key: "workflow", label: "WORKFLOW (6 STEPS)", rows: 8 },
      { key: "toolPolicy", label: "TOOL POLICY", rows: 5 },
      { key: "memoryPolicy", label: "MEMORY POLICY", rows: 4 },
      { key: "pilotScope", label: "PILOT SCOPE", rows: 5 },
    ];

    return (
      <Step
        storyHeader={M06_OCR_CONTENT.storyHeader}
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 1 of 5"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        }
        yourVersion={
          <div className="space-y-6">
            <AgentCapabilityMap capabilities={M06_OCR_CONTENT.capabilities} />
            <div className="space-y-4">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <p className="eyebrow-muted">{f.label}</p>
                  <textarea
                    value={design[f.key]}
                    onChange={(e) => {
                      const next = { ...design, [f.key]: e.target.value };
                      setDesign(next);
                      designOut.setValue.mutate(next);
                    }}
                    rows={f.rows}
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
                  />
                </div>
              ))}
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allFilled}
        disabledReason="Fill all five blueprint fields."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await designOut.setValue.mutateAsync(design);
          await goToStep(2);
        }}
      />
    );
  }

  // ============ STEP 2 — Integration plan ============
  if (step === 2) {
    const s = M06_OCR_CONTENT.step2;
    const allChosen = INTEGRATION_IDS.every((id) => integration[id] !== "");

    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 2 of 5"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        }
        yourVersion={
          <div className="space-y-6">
            <IntegrationPlanTable integrations={M06_OCR_CONTENT.integrations} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-navy">Pick a planned status for each integration.</p>
              <ul className="space-y-2">
                {M06_OCR_CONTENT.integrations.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-md border border-chalk bg-white px-3 py-2 flex flex-wrap items-center gap-3"
                  >
                    <span className="text-sm font-medium text-navy w-40 shrink-0">{i.system}</span>
                    {INTEGRATION_STATUSES.map((opt) => {
                      const selected = integration[i.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = { ...integration, [i.id]: opt.value };
                            setIntegration(next);
                            integrationOut.setValue.mutate(next);
                          }}
                          className={`rounded-full px-3 py-1 text-[12px] font-mono uppercase tracking-[0.16em] transition-colors ${
                            selected
                              ? "bg-terracotta text-white"
                              : "bg-mist text-slate hover:bg-mist/70"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allChosen}
        disabledReason="Pick a status for all four integrations."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await integrationOut.setValue.mutateAsync(integration);
          await goToStep(3);
        }}
      />
    );
  }

  // ============ STEP 3 — HITL policy ============
  if (step === 3) {
    const s = M06_OCR_CONTENT.step3;
    const allChosen = HITL_IDS.every((id) => hitl[id] !== "");
    const requiredOk =
      hitl.payment_or_sync === "required" && hitl.exception === "required";
    const canContinue = allChosen && requiredOk;

    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 3 of 5"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        }
        yourVersion={
          <div className="space-y-6">
            <HITLCheckpointMatrix checkpoints={M06_OCR_CONTENT.hitlCheckpoints} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-navy">
                Set severity. Payment/sync and exception must be required.
              </p>
              <ul className="space-y-2">
                {M06_OCR_CONTENT.hitlCheckpoints.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-chalk bg-white px-3 py-2 flex flex-wrap items-center gap-3"
                  >
                    <span className="text-sm font-medium text-navy w-44 shrink-0">
                      {c.id.replace(/_/g, " ")}
                    </span>
                    {HITL_SEVERITIES.map((opt) => {
                      const selected = hitl[c.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = { ...hitl, [c.id]: opt.value };
                            setHitl(next);
                            hitlOut.setValue.mutate(next);
                          }}
                          className={`rounded-full px-3 py-1 text-[12px] font-mono uppercase tracking-[0.16em] transition-colors ${
                            selected
                              ? opt.value === "required"
                                ? "bg-terracotta text-white"
                                : opt.value === "recommended"
                                  ? "bg-navy text-white"
                                  : "bg-graphite text-white"
                              : "bg-mist text-slate hover:bg-mist/70"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Set every severity. Payment/sync and exception must be required."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await hitlOut.setValue.mutateAsync(hitl);
          await goToStep(4);
        }}
      />
    );
  }

  // ============ STEP 4 — Pilot plan ============
  if (step === 4) {
    const s = M06_OCR_CONTENT.step4;
    const baseFilled =
      pilot.population.trim() !== "" &&
      pilot.window.trim() !== "" &&
      pilot.rollbackOwner.trim() !== "";
    const targetsFilled = METRIC_IDS.every((id) => pilot.targets[id].trim() !== "");
    const canContinue = baseFilled && targetsFilled;

    const baseFields: { key: "population" | "window" | "rollbackOwner"; label: string; placeholder: string }[] = [
      { key: "population", label: "PILOT POPULATION", placeholder: "Who and which data are in scope?" },
      { key: "window", label: "TIME WINDOW", placeholder: "Start date → end date." },
      { key: "rollbackOwner", label: "ROLLBACK OWNER", placeholder: "One named person." },
    ];

    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 4 of 5"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        }
        yourVersion={
          <div className="space-y-6">
            <PilotMetricList metrics={M06_OCR_CONTENT.pilotMetrics} />

            <div className="space-y-3">
              {baseFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <p className="eyebrow-muted">{f.label}</p>
                  <textarea
                    value={pilot[f.key]}
                    onChange={(e) => {
                      const next = { ...pilot, [f.key]: e.target.value };
                      setPilot(next);
                      pilotOut.setValue.mutate(next);
                    }}
                    rows={2}
                    placeholder={f.placeholder}
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-navy">Set a target value for each metric.</p>
              {M06_OCR_CONTENT.pilotMetrics.map((m) => (
                <div key={m.id} className="space-y-1">
                  <p className="eyebrow-muted">TARGET · {m.label.toUpperCase()}</p>
                  <textarea
                    value={pilot.targets[m.id]}
                    onChange={(e) => {
                      const next: PilotPlanOutput = {
                        ...pilot,
                        targets: { ...pilot.targets, [m.id]: e.target.value },
                      };
                      setPilot(next);
                      pilotOut.setValue.mutate(next);
                    }}
                    rows={2}
                    placeholder={m.target}
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                  />
                </div>
              ))}
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Fill population, window, rollback owner, and all five metric targets."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(3)}
        onContinue={async () => {
          await pilotOut.setValue.mutateAsync(pilot);
          await goToStep(5);
        }}
      />
    );
  }

  // ============ STEP 5 — Readiness dossier ============
  const s = M06_OCR_CONTENT.step5;
  const canComplete = readiness.dossierReviewed && readiness.gate2Ready;

  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 5 of 5 · GATE 2 DOSSIER"
      title={s.title}
      why={<p>{s.why}</p>}
      example={<p className="text-[14px] text-navy">{s.example}</p>}
      whatToNotice={
        <ul className="list-disc pl-5 text-[14px] text-navy">
          {s.whatToNotice.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      }
      yourVersion={
        <div className="space-y-6">
          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2">
            <p className="eyebrow-muted">AGENT DESIGN</p>
            <p className="text-[13px] text-navy"><span className="font-medium">Goal:</span> {design.agentGoal || "—"}</p>
            <p className="text-[12px] text-slate whitespace-pre-line">{design.workflow || "—"}</p>
          </div>

          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1">
            <p className="eyebrow-muted">INTEGRATION POSTURE</p>
            <ul className="text-[12px] text-navy">
              {M06_OCR_CONTENT.integrations.map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.system}:</span>{" "}
                  {integration[i.id] || "—"}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1">
            <p className="eyebrow-muted">HITL POLICY</p>
            <ul className="text-[12px] text-navy">
              {M06_OCR_CONTENT.hitlCheckpoints.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.id.replace(/_/g, " ")}:</span>{" "}
                  {hitl[c.id] || "—"}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1">
            <p className="eyebrow-muted">PILOT PLAN</p>
            <p className="text-[12px] text-navy"><span className="font-medium">Population:</span> {pilot.population || "—"}</p>
            <p className="text-[12px] text-navy"><span className="font-medium">Window:</span> {pilot.window || "—"}</p>
            <p className="text-[12px] text-navy"><span className="font-medium">Rollback owner:</span> {pilot.rollbackOwner || "—"}</p>
            <ul className="text-[12px] text-navy mt-1">
              {M06_OCR_CONTENT.pilotMetrics.map((m) => (
                <li key={m.id}>
                  <span className="font-medium">{m.label}:</span> {pilot.targets[m.id] || "—"}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1">
            <p className="eyebrow-muted">GATE 2 CRITERIA</p>
            <ul className="list-disc pl-5 text-[12px] text-slate">
              {M06_OCR_CONTENT.gate2Criteria.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-navy">{c.label}:</span> {c.question}
                </li>
              ))}
            </ul>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
            <input
              type="checkbox"
              checked={readiness.dossierReviewed}
              onChange={(e) => {
                const next = { ...readiness, dossierReviewed: e.target.checked };
                setReadiness(next);
                readinessOut.setValue.mutate(next);
              }}
              className="mt-1 h-4 w-4 accent-terracotta"
            />
            I have reviewed the dossier above end-to-end.
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
            <input
              type="checkbox"
              checked={readiness.gate2Ready}
              onChange={(e) => {
                const next = { ...readiness, gate2Ready: e.target.checked };
                setReadiness(next);
                readinessOut.setValue.mutate(next);
              }}
              className="mt-1 h-4 w-4 accent-terracotta"
            />
            This is the version I will bring to Gate 2.
          </label>

          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M06_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canComplete}
      disabledReason="Acknowledge dossier review and Gate 2 readiness."
      nextLabel="Complete M06 → Gate 2"
      onBack={() => goToStep(4)}
      onContinue={completeM06}
    />
  );
}

export function M06WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m06" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
