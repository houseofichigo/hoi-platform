import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAssessProgress, useAssessOutput } from "@/hooks/useAssess";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { useUseCaseProfile } from "@/hooks/useUseCaseProfile";
import { supabase } from "@/integrations/supabase/client";
import { Step } from "@/components/assess/Step";
import {
  RoadmapHorizonPlanner,
  type HorizonInitiative,
} from "@/components/assess/RoadmapHorizonPlanner";
import {
  CapabilityGapMatrix,
  type CapabilityGapState,
} from "@/components/assess/CapabilityGapMatrix";
import { ExecutiveScorecard } from "@/components/assess/ExecutiveScorecard";
import { ExecutiveSummaryEditor } from "@/components/assess/ExecutiveSummaryEditor";
import {
  M12_OCR_CONTENT,
  getM12StrategyScaffold,
  type CapabilityGapId,
  type RoadmapHorizonId,
} from "@/lib/worked-examples/invoice-ocr/m12";

const CHAPTER_LABEL = "PHASE 04 · M12 · AI STRATEGY & ROADMAP";
const TOTAL_STEPS = 4;
type StepNum = 1 | 2 | 3 | 4;

const HORIZON_IDS: readonly RoadmapHorizonId[] = ["now", "next", "later"];
const GAP_IDS: readonly CapabilityGapId[] = [
  "people",
  "tools",
  "partnerships",
  "governance",
];

interface RoadmapOutput {
  initiatives: Record<RoadmapHorizonId, HorizonInitiative[]>;
  rationale: string;
}
interface GapsOutput {
  gaps: Record<CapabilityGapId, CapabilityGapState>;
}
interface ScorecardOutput {
  selected: Record<string, boolean>;
  targets: Record<string, string>;
}
interface SummaryOutput {
  summary: string;
  nextPilot: Record<string, boolean>;
  acknowledged: boolean;
}

function emptyRoadmap(): RoadmapOutput {
  return {
    initiatives: HORIZON_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: [] }),
      {} as Record<RoadmapHorizonId, HorizonInitiative[]>,
    ),
    rationale: "",
  };
}
function emptyGaps(): GapsOutput {
  return {
    gaps: GAP_IDS.reduce(
      (acc, id) => ({
        ...acc,
        [id]: { notes: "", owner: "", nextAction: "" },
      }),
      {} as Record<CapabilityGapId, CapabilityGapState>,
    ),
  };
}
function emptyScorecard(): ScorecardOutput {
  return { selected: {}, targets: {} };
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function M12Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m12");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const roadmapOut = useAssessOutput<RoadmapOutput>("m12.roadmap");
  const gapsOut = useAssessOutput<GapsOutput>("m12.capability_gaps");
  const scorecardOut = useAssessOutput<ScorecardOutput>("m12.scorecard");
  const summaryOut = useAssessOutput<SummaryOutput>("m12.executive_summary");

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
    () => getM12StrategyScaffold(profileContext),
    [profileContext],
  );

  const [step, setStep] = useState<StepNum>(1);
  const [roadmap, setRoadmap] = useState<RoadmapOutput>(emptyRoadmap);
  const [gaps, setGaps] = useState<GapsOutput>(emptyGaps);
  const [scorecard, setScorecard] = useState<ScorecardOutput>(emptyScorecard);
  const [summary, setSummary] = useState<SummaryOutput>({
    summary: scaffold.executiveSummary,
    nextPilot: {},
    acknowledged: false,
  });

  const [hydrated, setHydrated] = useState({
    step: false,
    roadmap: false,
    gaps: false,
    scorecard: false,
    summary: false,
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

  // Hydrate roadmap
  useEffect(() => {
    if (hydrated.roadmap || roadmapOut.isLoading) return;
    if (roadmapOut.value && typeof roadmapOut.value === "object") {
      const v = roadmapOut.value as Partial<RoadmapOutput>;
      const merged = emptyRoadmap();
      if (v.initiatives && typeof v.initiatives === "object") {
        for (const id of HORIZON_IDS) {
          const list = (v.initiatives as Record<string, unknown>)[id];
          if (Array.isArray(list)) {
            merged.initiatives[id] = list
              .filter(
                (x): x is HorizonInitiative =>
                  !!x &&
                  typeof x === "object" &&
                  typeof (x as HorizonInitiative).id === "string" &&
                  typeof (x as HorizonInitiative).label === "string",
              )
              .map((x) => ({ id: x.id, label: x.label }));
          }
        }
      }
      merged.rationale = typeof v.rationale === "string" ? v.rationale : "";
      setRoadmap(merged);
    }
    setHydrated((h) => ({ ...h, roadmap: true }));
  }, [hydrated.roadmap, roadmapOut.isLoading, roadmapOut.value]);

  // Hydrate gaps
  useEffect(() => {
    if (hydrated.gaps || gapsOut.isLoading) return;
    if (gapsOut.value && typeof gapsOut.value === "object") {
      const v = gapsOut.value as Partial<GapsOutput>;
      const merged = emptyGaps();
      if (v.gaps && typeof v.gaps === "object") {
        for (const id of GAP_IDS) {
          const g = (v.gaps as Record<string, Partial<CapabilityGapState>>)[id];
          if (g && typeof g === "object") {
            merged.gaps[id] = {
              notes: typeof g.notes === "string" ? g.notes : "",
              owner: typeof g.owner === "string" ? g.owner : "",
              nextAction: typeof g.nextAction === "string" ? g.nextAction : "",
            };
          }
        }
      }
      setGaps(merged);
    }
    setHydrated((h) => ({ ...h, gaps: true }));
  }, [hydrated.gaps, gapsOut.isLoading, gapsOut.value]);

  // Hydrate scorecard
  useEffect(() => {
    if (hydrated.scorecard || scorecardOut.isLoading) return;
    if (scorecardOut.value && typeof scorecardOut.value === "object") {
      const v = scorecardOut.value as Partial<ScorecardOutput>;
      setScorecard({
        selected:
          v.selected && typeof v.selected === "object"
            ? (v.selected as Record<string, boolean>)
            : {},
        targets:
          v.targets && typeof v.targets === "object"
            ? (v.targets as Record<string, string>)
            : {},
      });
    }
    setHydrated((h) => ({ ...h, scorecard: true }));
  }, [hydrated.scorecard, scorecardOut.isLoading, scorecardOut.value]);

  // Hydrate summary
  useEffect(() => {
    if (hydrated.summary || summaryOut.isLoading) return;
    if (summaryOut.value && typeof summaryOut.value === "object") {
      const v = summaryOut.value as Partial<SummaryOutput>;
      setSummary({
        summary:
          typeof v.summary === "string" && v.summary.length > 0
            ? v.summary
            : scaffold.executiveSummary,
        nextPilot:
          v.nextPilot && typeof v.nextPilot === "object"
            ? (v.nextPilot as Record<string, boolean>)
            : {},
        acknowledged: v.acknowledged === true,
      });
    } else {
      setSummary({ summary: scaffold.executiveSummary, nextPilot: {}, acknowledged: false });
    }
    setHydrated((h) => ({ ...h, summary: true }));
  }, [hydrated.summary, summaryOut.isLoading, summaryOut.value, scaffold]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM12 = async () => {
    if (!user || !workspace) return;
    await summaryOut.setValue.mutateAsync(summary);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m12",
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
      toast.error("Could not complete M12. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m12"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M12 complete. The Handoff Pack is complete.");
    navigate({
      to: "/app/$workspaceSlug/assess/complete",
      params: { workspaceSlug: workspace.slug },
    });
  };

  if (!workspace) return null;

  // ===== STEP 1 — roadmap sequencing =====
  if (step === 1) {
    const s = M12_OCR_CONTENT.step1;
    const nowCount = (roadmap.initiatives.now ?? []).length;
    const canContinue = nowCount >= 1;

    return (
      <Step
        storyHeader={M12_OCR_CONTENT.storyHeader}
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
          <RoadmapHorizonPlanner
            horizons={M12_OCR_CONTENT.horizons}
            initiatives={roadmap.initiatives}
            rationale={roadmap.rationale}
            onAdd={(horizon, label) => {
              const next: RoadmapOutput = {
                ...roadmap,
                initiatives: {
                  ...roadmap.initiatives,
                  [horizon]: [
                    ...(roadmap.initiatives[horizon] ?? []),
                    { id: uid(), label },
                  ],
                },
              };
              setRoadmap(next);
              roadmapOut.setValue.mutate(next);
            }}
            onRemove={(horizon, id) => {
              const next: RoadmapOutput = {
                ...roadmap,
                initiatives: {
                  ...roadmap.initiatives,
                  [horizon]: (roadmap.initiatives[horizon] ?? []).filter(
                    (i) => i.id !== id,
                  ),
                },
              };
              setRoadmap(next);
              roadmapOut.setValue.mutate(next);
            }}
            onRationaleChange={(value) => {
              const next: RoadmapOutput = { ...roadmap, rationale: value };
              setRoadmap(next);
              roadmapOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Add at least one Now initiative."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await roadmapOut.setValue.mutateAsync(roadmap);
          await goToStep(2);
        }}
      />
    );
  }

  // ===== STEP 2 — capability gaps =====
  if (step === 2) {
    const s = M12_OCR_CONTENT.step2;
    const allFilled = true;

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
          <CapabilityGapMatrix
            gaps={M12_OCR_CONTENT.capabilityGaps}
            state={gaps.gaps}
            onChange={(id, nextGap) => {
              const next: GapsOutput = {
                gaps: { ...gaps.gaps, [id]: nextGap },
              };
              setGaps(next);
              gapsOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allFilled}
        disabledReason="Review the four gap categories."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await gapsOut.setValue.mutateAsync(gaps);
          await goToStep(3);
        }}
      />
    );
  }

  // ===== STEP 3 — executive scorecard =====
  if (step === 3) {
    const s = M12_OCR_CONTENT.step3;
    const selectedMetrics = M12_OCR_CONTENT.scorecardMetrics.filter(
      (m) => scorecard.selected[m.id],
    );
    const allHaveTargets = selectedMetrics.every(
      (m) => (scorecard.targets[m.id] ?? "").trim().length > 0,
    );
    const canContinue = selectedMetrics.length >= 6 && allHaveTargets;

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
          <ExecutiveScorecard
            metrics={M12_OCR_CONTENT.scorecardMetrics}
            selected={scorecard.selected}
            targets={scorecard.targets}
            onToggle={(id) => {
              const next: ScorecardOutput = {
                ...scorecard,
                selected: { ...scorecard.selected, [id]: !scorecard.selected[id] },
              };
              setScorecard(next);
              scorecardOut.setValue.mutate(next);
            }}
            onTargetChange={(id, value) => {
              const next: ScorecardOutput = {
                ...scorecard,
                targets: { ...scorecard.targets, [id]: value },
              };
              setScorecard(next);
              scorecardOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Select at least 6 metrics and give every selected metric an explicit target."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await scorecardOut.setValue.mutateAsync(scorecard);
          await goToStep(4);
        }}
      />
    );
  }

  // ===== STEP 4 — executive summary + next pilot =====
  const s = M12_OCR_CONTENT.step4;
  const selectedCriteria = M12_OCR_CONTENT.nextPilotCriteria.filter(
    (c) => summary.nextPilot[c.id],
  ).length;
  const canContinue = summary.acknowledged && selectedCriteria >= 3;

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
          <ExecutiveSummaryEditor
            summary={summary.summary}
            onSummaryChange={(value) => {
              const next: SummaryOutput = { ...summary, summary: value };
              setSummary(next);
              summaryOut.setValue.mutate(next);
            }}
            criteria={M12_OCR_CONTENT.nextPilotCriteria}
            selected={summary.nextPilot}
            onToggle={(id) => {
              const next: SummaryOutput = {
                ...summary,
                nextPilot: { ...summary.nextPilot, [id]: !summary.nextPilot[id] },
              };
              setSummary(next);
              summaryOut.setValue.mutate(next);
            }}
            acknowledged={summary.acknowledged}
            onAcknowledge={(checked) => {
              const next: SummaryOutput = { ...summary, acknowledged: checked };
              setSummary(next);
              summaryOut.setValue.mutate(next);
            }}
          />
          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M12_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canContinue}
      disabledReason="Acknowledge the generated summary and select at least 3 next-pilot criteria."
      nextLabel="Complete M12"
      onBack={() => goToStep(3)}
      onContinue={completeM12}
    />
  );
}
