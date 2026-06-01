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
import { ArchitectureChoiceGrid } from "@/components/assess/ArchitectureChoiceGrid";
import { SecurityRiskPicker } from "@/components/assess/SecurityRiskPicker";
import { CostModelTable, type CostRow } from "@/components/assess/CostModelTable";
import { DeploymentPlanEditor } from "@/components/assess/DeploymentPlanEditor";
import {
  M08_OCR_CONTENT,
  getM08DeploymentPlanScaffold,
  type ArchitectureChoiceId,
  type CostCategoryId,
  type DeploymentPlanScaffold,
} from "@/lib/worked-examples/invoice-ocr/m08";

const CHAPTER_LABEL = "PHASE 03 · M08 · DEPLOYMENT PLANNING";
const TOTAL_STEPS = 4;
type StepNum = 1 | 2 | 3 | 4;

const ARCHITECTURE_IDS: readonly ArchitectureChoiceId[] = [
  "hosting",
  "model",
  "orchestration",
  "storage",
];
const COST_IDS: readonly CostCategoryId[] = [
  "tokens",
  "ocr_api",
  "infrastructure",
  "licensing",
  "human_review",
];

interface ArchitectureOutput {
  choices: Record<ArchitectureChoiceId, string>;
  rationale: string;
}
interface SecurityOutput {
  selected: string[];
  mitigations: Record<string, string>;
}
type CostOutput = Record<CostCategoryId, CostRow>;

function emptyArchitecture(): ArchitectureOutput {
  return {
    choices: { hosting: "", model: "", orchestration: "", storage: "" },
    rationale: "",
  };
}
function emptyCost(): CostOutput {
  return COST_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: { volume: 0, unitCost: 0, notes: "" } }),
    {} as CostOutput,
  );
}

export function M08Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m08");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const architectureOut = useAssessOutput<ArchitectureOutput>("m08.architecture");
  const securityOut = useAssessOutput<SecurityOutput>("m08.security_risks");
  const costOut = useAssessOutput<CostOutput>("m08.cost_model");
  const planOut = useAssessOutput<DeploymentPlanScaffold>("m08.integration_plan");

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
    () => getM08DeploymentPlanScaffold(profileContext),
    [profileContext],
  );

  const [step, setStep] = useState<StepNum>(1);
  const [architecture, setArchitecture] = useState<ArchitectureOutput>(emptyArchitecture);
  const [security, setSecurity] = useState<SecurityOutput>({ selected: [], mitigations: {} });
  const [cost, setCost] = useState<CostOutput>(emptyCost);
  const [plan, setPlan] = useState<DeploymentPlanScaffold>(scaffold);

  const [hydrated, setHydrated] = useState({
    step: false,
    architecture: false,
    security: false,
    cost: false,
    plan: false,
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

  // Hydrate architecture
  useEffect(() => {
    if (hydrated.architecture || architectureOut.isLoading) return;
    if (architectureOut.value && typeof architectureOut.value === "object") {
      const v = architectureOut.value as Partial<ArchitectureOutput>;
      const merged = emptyArchitecture();
      if (v.choices) {
        for (const id of ARCHITECTURE_IDS) {
          const val = v.choices[id];
          if (typeof val === "string") merged.choices[id] = val;
        }
      }
      if (typeof v.rationale === "string") merged.rationale = v.rationale;
      setArchitecture(merged);
    }
    setHydrated((h) => ({ ...h, architecture: true }));
  }, [hydrated.architecture, architectureOut.isLoading, architectureOut.value]);

  // Hydrate security
  useEffect(() => {
    if (hydrated.security || securityOut.isLoading) return;
    if (securityOut.value && typeof securityOut.value === "object") {
      const v = securityOut.value as Partial<SecurityOutput>;
      setSecurity({
        selected: Array.isArray(v.selected)
          ? v.selected.filter((s): s is string => typeof s === "string").slice(0, 3)
          : [],
        mitigations:
          v.mitigations && typeof v.mitigations === "object"
            ? (v.mitigations as Record<string, string>)
            : {},
      });
    }
    setHydrated((h) => ({ ...h, security: true }));
  }, [hydrated.security, securityOut.isLoading, securityOut.value]);

  // Hydrate cost
  useEffect(() => {
    if (hydrated.cost || costOut.isLoading) return;
    if (costOut.value && typeof costOut.value === "object") {
      const v = costOut.value as Partial<CostOutput>;
      const merged = emptyCost();
      for (const id of COST_IDS) {
        const row = v[id];
        if (row && typeof row === "object") {
          merged[id] = {
            volume: typeof row.volume === "number" && row.volume >= 0 ? row.volume : 0,
            unitCost:
              typeof row.unitCost === "number" && row.unitCost >= 0 ? row.unitCost : 0,
            notes: typeof row.notes === "string" ? row.notes : "",
          };
        }
      }
      setCost(merged);
    }
    setHydrated((h) => ({ ...h, cost: true }));
  }, [hydrated.cost, costOut.isLoading, costOut.value]);

  // Hydrate plan — seed from scaffold
  useEffect(() => {
    if (hydrated.plan || planOut.isLoading) return;
    if (planOut.value && typeof planOut.value === "object") {
      const v = planOut.value as Partial<DeploymentPlanScaffold>;
      setPlan({
        architecture:
          v.architecture && v.architecture.length > 0 ? v.architecture : scaffold.architecture,
        dataFlow: v.dataFlow && v.dataFlow.length > 0 ? v.dataFlow : scaffold.dataFlow,
        securityRisks:
          v.securityRisks && v.securityRisks.length > 0
            ? v.securityRisks
            : scaffold.securityRisks,
        costModel: v.costModel && v.costModel.length > 0 ? v.costModel : scaffold.costModel,
        rollback: v.rollback && v.rollback.length > 0 ? v.rollback : scaffold.rollback,
        partnerHandoff:
          v.partnerHandoff && v.partnerHandoff.length > 0
            ? v.partnerHandoff
            : scaffold.partnerHandoff,
      });
    } else {
      setPlan(scaffold);
    }
    setHydrated((h) => ({ ...h, plan: true }));
  }, [hydrated.plan, planOut.isLoading, planOut.value, scaffold]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM08 = async () => {
    if (!user || !workspace) return;
    await planOut.setValue.mutateAsync(plan);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m08",
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
      toast.error("Could not complete M08. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m08"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M08 complete. M09 Portfolio Scoring is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId",
      params: { workspaceSlug: workspace.slug, moduleId: "m09" },
    });
  };

  if (!workspace) return null;

  // ===== STEP 1 — architecture =====
  if (step === 1) {
    const s = M08_OCR_CONTENT.step1;
    const allChosen = ARCHITECTURE_IDS.every((id) => architecture.choices[id] !== "");
    const canContinue = allChosen;

    return (
      <Step
        storyHeader={M08_OCR_CONTENT.storyHeader}
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
          <div className="space-y-6">
            <ArchitectureChoiceGrid
              choices={M08_OCR_CONTENT.architectureChoices}
              value={architecture.choices}
              onSelect={(id, option) => {
                const next: ArchitectureOutput = {
                  ...architecture,
                  choices: { ...architecture.choices, [id]: option },
                };
                setArchitecture(next);
                architectureOut.setValue.mutate(next);
              }}
            />
            <div className="space-y-1">
              <p className="eyebrow-muted">RATIONALE — OPTIONAL NOTE</p>
              <textarea
                value={architecture.rationale}
                onChange={(e) => {
                  const next = { ...architecture, rationale: e.target.value };
                  setArchitecture(next);
                  architectureOut.setValue.mutate(next);
                }}
                rows={4}
                placeholder="Why these four choices together? Min 40 characters."
                className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
              />
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Pick all four choices and write a rationale of at least 40 characters."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await architectureOut.setValue.mutateAsync(architecture);
          await goToStep(2);
        }}
      />
    );
  }

  // ===== STEP 2 — security risks =====
  if (step === 2) {
    const s = M08_OCR_CONTENT.step2;
    const exactlyThree = security.selected.length === 3;
    const allMitigated =
      exactlyThree &&
      security.selected.every((id) => (security.mitigations[id] ?? "").trim() !== "");

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
          <div className="space-y-4">
            <p className="text-[13px] text-slate">
              Selected {security.selected.length} of 3. Pick the three you would defend first.
            </p>
            <SecurityRiskPicker
              risks={M08_OCR_CONTENT.securityRisks}
              selected={security.selected}
              mitigations={security.mitigations}
              onToggle={(id) => {
                const isSelected = security.selected.includes(id);
                const nextSelected = isSelected
                  ? security.selected.filter((s) => s !== id)
                  : security.selected.length < 3
                    ? [...security.selected, id]
                    : security.selected;
                const nextMitigations = { ...security.mitigations };
                if (isSelected) delete nextMitigations[id];
                const next = { selected: nextSelected, mitigations: nextMitigations };
                setSecurity(next);
                securityOut.setValue.mutate(next);
              }}
              onMitigationChange={(id, text) => {
                const next = {
                  ...security,
                  mitigations: { ...security.mitigations, [id]: text },
                };
                setSecurity(next);
                securityOut.setValue.mutate(next);
              }}
            />
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allMitigated}
        disabledReason="Select exactly three risks and write a mitigation for each."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await securityOut.setValue.mutateAsync(security);
          await goToStep(3);
        }}
      />
    );
  }

  // ===== STEP 3 — cost model =====
  if (step === 3) {
    const s = M08_OCR_CONTENT.step3;
    const allValid = COST_IDS.every((id) => {
      const row = cost[id];
      return row && row.volume >= 0 && row.unitCost >= 0;
    });
    const notesCount = COST_IDS.filter((id) => (cost[id]?.notes ?? "").trim() !== "").length;
    const canContinue = allValid && notesCount >= 3;

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
          <CostModelTable
            categories={M08_OCR_CONTENT.costCategories}
            value={cost}
            onChange={(id, row) => {
              const next = { ...cost, [id]: row };
              setCost(next);
              costOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Set volume and unit cost for every category and add notes for at least 3."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await costOut.setValue.mutateAsync(cost);
          await goToStep(4);
        }}
      />
    );
  }

  // ===== STEP 4 — integration plan =====
  const s = M08_OCR_CONTENT.step4;
  const allFilled =
    plan.architecture.trim() !== "" &&
    plan.dataFlow.trim() !== "" &&
    plan.securityRisks.trim() !== "" &&
    plan.costModel.trim() !== "" &&
    plan.rollback.trim() !== "" &&
    plan.partnerHandoff.trim() !== "";

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
          <DeploymentPlanEditor
            sections={M08_OCR_CONTENT.planSections}
            value={plan}
            onChange={(next) => {
              setPlan(next);
              planOut.setValue.mutate(next);
            }}
          />
          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M08_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={allFilled}
      disabledReason="Fill all six plan sections."
      nextLabel="Complete M08 → M09"
      onBack={() => goToStep(3)}
      onContinue={completeM08}
    />
  );
}

export function M08WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m08" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
