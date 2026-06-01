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
import { StackLayerInventory } from "@/components/assess/StackLayerInventory";
import { ToolCriteriaMatrix } from "@/components/assess/ToolCriteriaMatrix";
import { ADRSectionEditor } from "@/components/assess/ADRSectionEditor";
import {
  M07_OCR_CONTENT,
  getM07ToolDecisionScaffold,
  type ToolCriterionId,
  type StackDecision,
  type ToolDecisionScaffold,
} from "@/lib/worked-examples/invoice-ocr/m07";

const CHAPTER_LABEL = "PHASE 03 · M07 · TOOLS & PLATFORMS";
const TOTAL_STEPS = 4;
type StepNum = 1 | 2 | 3 | 4;

type StackInventory = Record<string, { tool: string; gap: string }>;
type OptionId = "pilot_stack" | "alternative_stack";
type Scores = Record<OptionId, Record<ToolCriterionId, number>>;
type Evidence = Record<ToolCriterionId, string>;

interface ComparisonOutput {
  alternativeName: string;
  scores: Scores;
  evidence: Evidence;
}

interface DecisionOutput {
  decision: StackDecision | "";
  constraints: string;
  justification: string;
}

const CRITERION_IDS: readonly ToolCriterionId[] = [
  "capability",
  "cost",
  "residency",
  "training",
  "mcp",
  "audit",
  "compliance",
  "stability",
];

function emptyScores(): Scores {
  const blank = CRITERION_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: 0 }),
    {} as Record<ToolCriterionId, number>,
  );
  return { pilot_stack: { ...blank }, alternative_stack: { ...blank } };
}
function emptyEvidence(): Evidence {
  return CRITERION_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: "" }),
    {} as Evidence,
  );
}
function emptyInventory(): StackInventory {
  const out: StackInventory = {};
  for (const layer of M07_OCR_CONTENT.stackLayers) {
    out[layer.id] = { tool: "", gap: "" };
  }
  return out;
}

export function M07Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m07");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const inventoryOut = useAssessOutput<StackInventory>("m07.stack_inventory");
  const comparisonOut = useAssessOutput<ComparisonOutput>("m07.comparison_matrix");
  const adrOut = useAssessOutput<ToolDecisionScaffold>("m07.adr");
  const decisionOut = useAssessOutput<DecisionOutput>("m07.stack_decision");

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

  const scaffold = useMemo(() => getM07ToolDecisionScaffold(profileContext), [profileContext]);

  const [step, setStep] = useState<StepNum>(1);
  const [inventory, setInventory] = useState<StackInventory>(emptyInventory);
  const [comparison, setComparison] = useState<ComparisonOutput>({
    alternativeName: "",
    scores: emptyScores(),
    evidence: emptyEvidence(),
  });
  const [adr, setAdr] = useState<ToolDecisionScaffold>(scaffold);
  const [decision, setDecision] = useState<DecisionOutput>({
    decision: "",
    constraints: "",
    justification: "",
  });

  const [hydrated, setHydrated] = useState({
    step: false,
    inventory: false,
    comparison: false,
    adr: false,
    decision: false,
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

  // Hydrate inventory
  useEffect(() => {
    if (hydrated.inventory || inventoryOut.isLoading) return;
    if (inventoryOut.value && typeof inventoryOut.value === "object") {
      const merged = emptyInventory();
      const v = inventoryOut.value as Partial<StackInventory>;
      for (const layer of M07_OCR_CONTENT.stackLayers) {
        const entry = v[layer.id];
        if (entry && typeof entry === "object") {
          merged[layer.id] = {
            tool: typeof entry.tool === "string" ? entry.tool : "",
            gap: typeof entry.gap === "string" ? entry.gap : "",
          };
        }
      }
      setInventory(merged);
    }
    setHydrated((h) => ({ ...h, inventory: true }));
  }, [hydrated.inventory, inventoryOut.isLoading, inventoryOut.value]);

  // Hydrate comparison
  useEffect(() => {
    if (hydrated.comparison || comparisonOut.isLoading) return;
    if (comparisonOut.value && typeof comparisonOut.value === "object") {
      const v = comparisonOut.value as Partial<ComparisonOutput>;
      const scores = emptyScores();
      const evidence = emptyEvidence();
      if (v.scores) {
        for (const opt of ["pilot_stack", "alternative_stack"] as OptionId[]) {
          const optScores = v.scores[opt];
          if (optScores) {
            for (const id of CRITERION_IDS) {
              const s = optScores[id];
              if (typeof s === "number" && s >= 1 && s <= 5) scores[opt][id] = s;
            }
          }
        }
      }
      if (v.evidence) {
        for (const id of CRITERION_IDS) {
          const e = v.evidence[id];
          if (typeof e === "string") evidence[id] = e;
        }
      }
      setComparison({
        alternativeName: typeof v.alternativeName === "string" ? v.alternativeName : "",
        scores,
        evidence,
      });
    }
    setHydrated((h) => ({ ...h, comparison: true }));
  }, [hydrated.comparison, comparisonOut.isLoading, comparisonOut.value]);

  // Hydrate ADR — seed from scaffold
  useEffect(() => {
    if (hydrated.adr || adrOut.isLoading) return;
    if (adrOut.value && typeof adrOut.value === "object") {
      const v = adrOut.value as Partial<ToolDecisionScaffold>;
      setAdr({
        context: v.context && v.context.length > 0 ? v.context : scaffold.context,
        options: v.options && v.options.length > 0 ? v.options : scaffold.options,
        decision: v.decision && v.decision.length > 0 ? v.decision : scaffold.decision,
        rationale: v.rationale && v.rationale.length > 0 ? v.rationale : scaffold.rationale,
        consequences:
          v.consequences && v.consequences.length > 0 ? v.consequences : scaffold.consequences,
        reviewPlan:
          v.reviewPlan && v.reviewPlan.length > 0 ? v.reviewPlan : scaffold.reviewPlan,
      });
    } else {
      setAdr(scaffold);
    }
    setHydrated((h) => ({ ...h, adr: true }));
  }, [hydrated.adr, adrOut.isLoading, adrOut.value, scaffold]);

  // Hydrate decision
  useEffect(() => {
    if (hydrated.decision || decisionOut.isLoading) return;
    if (decisionOut.value && typeof decisionOut.value === "object") {
      const v = decisionOut.value as Partial<DecisionOutput>;
      setDecision({
        decision:
          v.decision === "keep" || v.decision === "replace" || v.decision === "constrain"
            ? v.decision
            : "",
        constraints: typeof v.constraints === "string" ? v.constraints : "",
        justification: typeof v.justification === "string" ? v.justification : "",
      });
    }
    setHydrated((h) => ({ ...h, decision: true }));
  }, [hydrated.decision, decisionOut.isLoading, decisionOut.value]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM07 = async () => {
    if (!user || !workspace) return;
    await decisionOut.setValue.mutateAsync(decision);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m07",
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
      toast.error("Could not complete M07. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m07"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M07 complete. M08 Deployment Planning is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId",
      params: { workspaceSlug: workspace.slug, moduleId: "m08" },
    });
  };

  if (!workspace) return null;

  // ===== STEP 1 — inventory =====
  if (step === 1) {
    const s = M07_OCR_CONTENT.step1;
    const allFilled = M07_OCR_CONTENT.stackLayers.every(
      (l) => inventory[l.id]?.tool.trim() !== "",
    );

    return (
      <Step
        storyHeader={M07_OCR_CONTENT.storyHeader}
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
            <StackLayerInventory layers={M07_OCR_CONTENT.stackLayers} />
            <div className="space-y-4">
              {M07_OCR_CONTENT.stackLayers.map((layer) => (
                <div key={layer.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-2">
                  <p className="eyebrow-muted">{layer.label.toUpperCase()}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Tool / vendor</p>
                      <input
                        type="text"
                        value={inventory[layer.id]?.tool ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...inventory,
                            [layer.id]: { ...inventory[layer.id], tool: e.target.value },
                          };
                          setInventory(next);
                          inventoryOut.setValue.mutate(next);
                        }}
                        placeholder="e.g. OpenAI GPT-5, Xero, Lovable Cloud..."
                        className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Known gap</p>
                      <input
                        type="text"
                        value={inventory[layer.id]?.gap ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...inventory,
                            [layer.id]: { ...inventory[layer.id], gap: e.target.value },
                          };
                          setInventory(next);
                          inventoryOut.setValue.mutate(next);
                        }}
                        placeholder="What's unknown or unconfirmed?"
                        className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allFilled}
        disabledReason="Name a tool for every stack layer."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await inventoryOut.setValue.mutateAsync(inventory);
          await goToStep(2);
        }}
      />
    );
  }

  // ===== STEP 2 — comparison =====
  if (step === 2) {
    const s = M07_OCR_CONTENT.step2;
    const allScored = CRITERION_IDS.every(
      (id) =>
        comparison.scores.pilot_stack[id] >= 1 &&
        comparison.scores.pilot_stack[id] <= 5 &&
        comparison.scores.alternative_stack[id] >= 1 &&
        comparison.scores.alternative_stack[id] <= 5,
    );
    const evidenceCount = CRITERION_IDS.filter(
      (id) => comparison.evidence[id].trim() !== "",
    ).length;
    const canContinue = allScored && evidenceCount >= 4;

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
          <div className="space-y-6">
            <ToolCriteriaMatrix criteria={M07_OCR_CONTENT.criteria} />

            <div className="space-y-1">
              <p className="eyebrow-muted">ALTERNATIVE STACK NAME</p>
              <input
                type="text"
                value={comparison.alternativeName}
                onChange={(e) => {
                  const next = { ...comparison, alternativeName: e.target.value };
                  setComparison(next);
                  comparisonOut.setValue.mutate(next);
                }}
                placeholder="e.g. Azure OpenAI + Power Automate"
                className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
              />
            </div>

            <div className="space-y-3">
              {M07_OCR_CONTENT.criteria.map((c) => (
                <div key={c.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{c.label}</p>
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">1 weak — 5 strong</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(["pilot_stack", "alternative_stack"] as OptionId[]).map((opt) => (
                      <div key={opt} className="space-y-1">
                        <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">
                          {opt === "pilot_stack" ? "Pilot stack" : "Alternative"}
                        </p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = comparison.scores[opt][c.id] === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  const next: ComparisonOutput = {
                                    ...comparison,
                                    scores: {
                                      ...comparison.scores,
                                      [opt]: { ...comparison.scores[opt], [c.id]: n },
                                    },
                                  };
                                  setComparison(next);
                                  comparisonOut.setValue.mutate(next);
                                }}
                                className={`h-8 w-8 rounded-md font-mono text-[12px] transition-colors ${
                                  selected
                                    ? "bg-terracotta text-white"
                                    : "bg-mist text-slate hover:bg-mist/70"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Evidence — optional note</p>
                    <textarea
                      value={comparison.evidence[c.id]}
                      onChange={(e) => {
                        const next: ComparisonOutput = {
                          ...comparison,
                          evidence: { ...comparison.evidence, [c.id]: e.target.value },
                        };
                        setComparison(next);
                        comparisonOut.setValue.mutate(next);
                      }}
                      rows={2}
                      placeholder={c.evidenceToCollect}
                      className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Score all 16 cells and write evidence for at least 4 criteria."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await comparisonOut.setValue.mutateAsync(comparison);
          await goToStep(3);
        }}
      />
    );
  }

  // ===== STEP 3 — ADR =====
  if (step === 3) {
    const s = M07_OCR_CONTENT.step3;
    const allFilled =
      adr.context.trim() !== "" &&
      adr.options.trim() !== "" &&
      adr.decision.trim() !== "" &&
      adr.rationale.trim() !== "" &&
      adr.consequences.trim() !== "" &&
      adr.reviewPlan.trim() !== "";

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
          <ADRSectionEditor
            sections={M07_OCR_CONTENT.adrSections}
            value={adr}
            onChange={(next) => {
              setAdr(next);
              adrOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allFilled}
        disabledReason="All six ADR sections must have content."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await adrOut.setValue.mutateAsync(adr);
          await goToStep(4);
        }}
      />
    );
  }

  // ===== STEP 4 — decision =====
  const s = M07_OCR_CONTENT.step4;
  const constraintsOk =
    decision.decision !== "constrain" || decision.constraints.trim().length > 0;
  const canComplete = decision.decision !== "" && constraintsOk;

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
          <div className="grid gap-2 md:grid-cols-3">
            {M07_OCR_CONTENT.decisionOptions.map((opt) => {
              const selected = decision.decision === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const next = { ...decision, decision: opt.id };
                    setDecision(next);
                    decisionOut.setValue.mutate(next);
                  }}
                  className={`text-left rounded-md border px-3 py-3 transition-colors ${
                    selected
                      ? "border-terracotta bg-terracotta/10"
                      : "border-chalk bg-white hover:border-navy/40"
                  }`}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                    {opt.label}
                  </p>
                  <p className="text-[13px] text-navy mt-1">{opt.summary}</p>
                </button>
              );
            })}
          </div>

          {decision.decision === "constrain" && (
            <div className="space-y-1">
              <p className="eyebrow-muted">ENFORCEABLE CONSTRAINTS — OPTIONAL NOTE</p>
              <textarea
                value={decision.constraints}
                onChange={(e) => {
                  const next = { ...decision, constraints: e.target.value };
                  setDecision(next);
                  decisionOut.setValue.mutate(next);
                }}
                rows={4}
                placeholder="e.g. EU-region only, volume ≤ X invoices/month, no payment release, named service account."
                className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
              />
            </div>
          )}

          <div className="space-y-1">
            <p className="eyebrow-muted">JUSTIFICATION — OPTIONAL NOTE</p>
            <textarea
              value={decision.justification}
              onChange={(e) => {
                const next = { ...decision, justification: e.target.value };
                setDecision(next);
                decisionOut.setValue.mutate(next);
              }}
              rows={5}
              placeholder="Optional — tie the decision to the comparison matrix and ADR if you want."
              className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
            />
          </div>

          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M07_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canComplete}
      disabledReason="Pick a decision and write a justification of at least 40 characters."
      nextLabel="Complete M07 → M08"
      onBack={() => goToStep(3)}
      onContinue={completeM07}
    />
  );
}

export function M07WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m07" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
