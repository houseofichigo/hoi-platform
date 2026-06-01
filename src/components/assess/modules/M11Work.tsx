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
import { MonitoringMetricGrid } from "@/components/assess/MonitoringMetricGrid";
import {
  AlertRuleTable,
  type AlertRuleState,
} from "@/components/assess/AlertRuleTable";
import {
  DriftRuleCards,
  type DriftRuleState,
} from "@/components/assess/DriftRuleCards";
import { RescoringCriteriaList } from "@/components/assess/RescoringCriteriaList";
import {
  M11_OCR_CONTENT,
  getM11MonitoringPlanScaffold,
  type DriftTypeId,
  type MonitoringCategoryId,
  type MonitoringPlanScaffold,
} from "@/lib/worked-examples/invoice-ocr/m11";

const CHAPTER_LABEL = "PHASE 04 · M11 · MONITORING & QUALITY";
const TOTAL_STEPS = 4;
type StepNum = 1 | 2 | 3 | 4;

const CATEGORIES: readonly MonitoringCategoryId[] = [
  "performance",
  "accuracy",
  "drift",
  "fairness",
];
const DRIFT_IDS: readonly DriftTypeId[] = ["data", "concept", "model"];

interface MetricsOutput {
  selected: Record<string, boolean>;
  owners: Record<string, string>;
}
interface AlertsOutput {
  rules: Record<string, AlertRuleState>;
}
interface DriftOutput {
  rules: Record<DriftTypeId, DriftRuleState>;
}
interface RescoringOutput {
  plan: MonitoringPlanScaffold;
  criteria: Record<string, boolean>;
}

function emptyMetrics(): MetricsOutput {
  return { selected: {}, owners: {} };
}
function emptyAlerts(): AlertsOutput {
  return { rules: {} };
}
function emptyDrift(): DriftOutput {
  return {
    rules: DRIFT_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: { detection: "", response: "" } }),
      {} as Record<DriftTypeId, DriftRuleState>,
    ),
  };
}

export function M11Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m11");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const metricsOut = useAssessOutput<MetricsOutput>("m11.metrics");
  const alertsOut = useAssessOutput<AlertsOutput>("m11.alerts");
  const driftOut = useAssessOutput<DriftOutput>("m11.drift_response");
  const rescoringOut = useAssessOutput<RescoringOutput>("m11.rescoring");

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

  const scaffold = useMemo(
    () => getM11MonitoringPlanScaffold(profileContext),
    [profileContext],
  );

  const [step, setStep] = useState<StepNum>(1);
  const [metrics, setMetrics] = useState<MetricsOutput>(emptyMetrics);
  const [alerts, setAlerts] = useState<AlertsOutput>(emptyAlerts);
  const [drift, setDrift] = useState<DriftOutput>(emptyDrift);
  const [rescoring, setRescoring] = useState<RescoringOutput>({
    plan: scaffold,
    criteria: {},
  });

  const [hydrated, setHydrated] = useState({
    step: false,
    metrics: false,
    alerts: false,
    drift: false,
    rescoring: false,
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

  // Hydrate metrics
  useEffect(() => {
    if (hydrated.metrics || metricsOut.isLoading) return;
    if (metricsOut.value && typeof metricsOut.value === "object") {
      const v = metricsOut.value as Partial<MetricsOutput>;
      setMetrics({
        selected:
          v.selected && typeof v.selected === "object"
            ? (v.selected as Record<string, boolean>)
            : {},
        owners:
          v.owners && typeof v.owners === "object"
            ? (v.owners as Record<string, string>)
            : {},
      });
    }
    setHydrated((h) => ({ ...h, metrics: true }));
  }, [hydrated.metrics, metricsOut.isLoading, metricsOut.value]);

  // Hydrate alerts
  useEffect(() => {
    if (hydrated.alerts || alertsOut.isLoading) return;
    if (alertsOut.value && typeof alertsOut.value === "object") {
      const v = alertsOut.value as Partial<AlertsOutput>;
      const rules: Record<string, AlertRuleState> = {};
      if (v.rules && typeof v.rules === "object") {
        for (const [id, raw] of Object.entries(v.rules)) {
          if (raw && typeof raw === "object") {
            const r = raw as Partial<AlertRuleState>;
            rules[id] = {
              enabled: r.enabled === true,
              owner: typeof r.owner === "string" ? r.owner : "",
              escalation: typeof r.escalation === "string" ? r.escalation : "",
            };
          }
        }
      }
      setAlerts({ rules });
    }
    setHydrated((h) => ({ ...h, alerts: true }));
  }, [hydrated.alerts, alertsOut.isLoading, alertsOut.value]);

  // Hydrate drift
  useEffect(() => {
    if (hydrated.drift || driftOut.isLoading) return;
    if (driftOut.value && typeof driftOut.value === "object") {
      const v = driftOut.value as Partial<DriftOutput>;
      const merged = emptyDrift();
      if (v.rules && typeof v.rules === "object") {
        for (const id of DRIFT_IDS) {
          const r = (v.rules as Record<string, Partial<DriftRuleState>>)[id];
          if (r && typeof r === "object") {
            merged.rules[id] = {
              detection: typeof r.detection === "string" ? r.detection : "",
              response: typeof r.response === "string" ? r.response : "",
            };
          }
        }
      }
      setDrift(merged);
    }
    setHydrated((h) => ({ ...h, drift: true }));
  }, [hydrated.drift, driftOut.isLoading, driftOut.value]);

  // Hydrate rescoring — seed plan from scaffold
  useEffect(() => {
    if (hydrated.rescoring || rescoringOut.isLoading) return;
    if (rescoringOut.value && typeof rescoringOut.value === "object") {
      const v = rescoringOut.value as Partial<RescoringOutput>;
      const plan: Partial<MonitoringPlanScaffold> =
        v.plan && typeof v.plan === "object" ? v.plan : {};
      setRescoring({
        plan: {
          metrics:
            typeof plan.metrics === "string" && plan.metrics.length > 0
              ? plan.metrics
              : scaffold.metrics,
          alerts:
            typeof plan.alerts === "string" && plan.alerts.length > 0
              ? plan.alerts
              : scaffold.alerts,
          driftResponse:
            typeof plan.driftResponse === "string" && plan.driftResponse.length > 0
              ? plan.driftResponse
              : scaffold.driftResponse,
          rescoringCriteria:
            typeof plan.rescoringCriteria === "string" && plan.rescoringCriteria.length > 0
              ? plan.rescoringCriteria
              : scaffold.rescoringCriteria,
        },
        criteria:
          v.criteria && typeof v.criteria === "object"
            ? (v.criteria as Record<string, boolean>)
            : {},
      });
    } else {
      setRescoring({ plan: scaffold, criteria: {} });
    }
    setHydrated((h) => ({ ...h, rescoring: true }));
  }, [hydrated.rescoring, rescoringOut.isLoading, rescoringOut.value, scaffold]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM11 = async () => {
    if (!user || !workspace) return;
    await rescoringOut.setValue.mutateAsync(rescoring);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m11",
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
      toast.error("Could not complete M11. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m11"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M11 complete. M12 Strategy & Roadmap is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId",
      params: { workspaceSlug: workspace.slug, moduleId: "m12" },
    });
  };

  if (!workspace) return null;

  // ===== STEP 1 — metrics =====
  if (step === 1) {
    const s = M11_OCR_CONTENT.step1;
    const selectedMetrics = M11_OCR_CONTENT.metrics.filter(
      (m) => metrics.selected[m.id],
    );
    const coverage = CATEGORIES.every((cat) =>
      selectedMetrics.some((m) => m.category === cat),
    );

    return (
      <Step
        storyHeader={M11_OCR_CONTENT.storyHeader}
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 1 of 4"
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
          <MonitoringMetricGrid
            metrics={M11_OCR_CONTENT.metrics}
            selected={metrics.selected}
            owners={metrics.owners}
            onToggle={(id) => {
              const next: MetricsOutput = {
                ...metrics,
                selected: { ...metrics.selected, [id]: !metrics.selected[id] },
              };
              setMetrics(next);
              metricsOut.setValue.mutate(next);
            }}
            onOwnerChange={(id, owner) => {
              const next: MetricsOutput = {
                ...metrics,
                owners: { ...metrics.owners, [id]: owner },
              };
              setMetrics(next);
              metricsOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={coverage}
        disabledReason="Pick at least one metric in each of performance, accuracy, drift, and fairness."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await metricsOut.setValue.mutateAsync(metrics);
          await goToStep(2);
        }}
      />
    );
  }

  // ===== STEP 2 — alerts =====
  if (step === 2) {
    const s = M11_OCR_CONTENT.step2;
    const enabledRules = M11_OCR_CONTENT.alertRules.filter(
      (r) => alerts.rules[r.id]?.enabled,
    );
    const enoughRules = enabledRules.length >= 4;
    const criticalStopHaveOwners = enabledRules
      .filter((r) => r.tier === "critical" || r.tier === "stop")
      .every((r) => (alerts.rules[r.id]?.owner ?? "").trim() !== "");
    const canContinue = enoughRules && criticalStopHaveOwners;

    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 2 of 4"
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
          <AlertRuleTable
            rules={M11_OCR_CONTENT.alertRules}
            state={alerts.rules}
            onChange={(id, next) => {
              const updated: AlertsOutput = {
                rules: { ...alerts.rules, [id]: next },
              };
              setAlerts(updated);
              alertsOut.setValue.mutate(updated);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Enable at least 4 alert rules and give every critical/stop rule a named owner."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await alertsOut.setValue.mutateAsync(alerts);
          await goToStep(3);
        }}
      />
    );
  }

  // ===== STEP 3 — drift =====
  if (step === 3) {
    const s = M11_OCR_CONTENT.step3;
    const allFilled = DRIFT_IDS.every((id) => {
      const r = drift.rules[id];
      return r && r.detection.trim() !== "" && r.response.trim() !== "";
    });

    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 3 of 4"
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
          <DriftRuleCards
            rules={M11_OCR_CONTENT.driftRules}
            state={drift.rules}
            onChange={(id, next) => {
              const updated: DriftOutput = {
                rules: { ...drift.rules, [id]: next },
              };
              setDrift(updated);
              driftOut.setValue.mutate(updated);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allFilled}
        disabledReason="Tick the adopt box for data, concept, and model drift (or supply your own in Advanced edit)."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await driftOut.setValue.mutateAsync(drift);
          await goToStep(4);
        }}
      />
    );
  }

  // ===== STEP 4 — monitoring plan + re-scoring =====
  const s = M11_OCR_CONTENT.step4;
  const selectedCriteria = M11_OCR_CONTENT.rescoringCriteria.filter(
    (c) => rescoring.criteria[c.id],
  ).length;
  const canContinue = selectedCriteria >= 3;

  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 4 of 4"
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
          <RescoringCriteriaList
            criteria={M11_OCR_CONTENT.rescoringCriteria}
            selected={rescoring.criteria}
            onToggle={(id) => {
              const next: RescoringOutput = {
                ...rescoring,
                criteria: { ...rescoring.criteria, [id]: !rescoring.criteria[id] },
              };
              setRescoring(next);
              rescoringOut.setValue.mutate(next);
            }}
          />
          <details className="group rounded-md border border-chalk bg-paper">
            <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
              Advanced — edit the generated monitoring plan (optional)
            </summary>
            <div className="space-y-4 p-3 pt-2">
              {(["metrics", "alerts", "driftResponse", "rescoringCriteria"] as const).map(
                (k) => (
                  <div key={k} className="space-y-1">
                    <p className="eyebrow-muted">{k.toUpperCase()}</p>
                    <textarea
                      value={rescoring.plan[k]}
                      onChange={(e) => {
                        const next: RescoringOutput = {
                          ...rescoring,
                          plan: { ...rescoring.plan, [k]: e.target.value },
                        };
                        setRescoring(next);
                        rescoringOut.setValue.mutate(next);
                      }}
                      rows={5}
                      className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
                    />
                  </div>
                ),
              )}
              <p className="text-[12px] text-slate">
                Optional. Your edits are saved automatically.
              </p>
            </div>
          </details>
          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M11_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canContinue}
      disabledReason="Select at least 3 re-scoring criteria."
      nextLabel="Complete M11 → M12"
      onBack={() => goToStep(3)}
      onContinue={completeM11}
    />
  );
}

export function M11WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m11" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
