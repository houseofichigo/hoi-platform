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
import { ScoringPillarGrid } from "@/components/assess/ScoringPillarGrid";
import { ReasonCodePicker } from "@/components/assess/ReasonCodePicker";
import {
  AutomationMapEditor,
  type AutomationMapEntry,
} from "@/components/assess/AutomationMapEditor";
import { PortfolioRankingTable } from "@/components/assess/PortfolioRankingTable";
import {
  M09_OCR_CONTENT,
  getM09PortfolioScaffold,
  type PillarId,
} from "@/lib/worked-examples/invoice-ocr/m09";

const CHAPTER_LABEL = "PHASE 03 · M09 · PORTFOLIO SCORING";
const TOTAL_STEPS = 5;
type StepNum = 1 | 2 | 3 | 4 | 5;

const PILLAR_IDS: readonly PillarId[] = [
  "impact",
  "feasibility",
  "process",
  "risk",
  "ai",
  "agent",
  "readiness",
  "priority",
];

interface CandidateInput {
  id: string;
  name: string;
  description: string;
  owner: string;
}

type CandidatesOutput = CandidateInput[];

interface CandidateScores {
  scores: Record<PillarId, number>;
  reasonCodes: string[];
}
type ScoresOutput = Record<string, CandidateScores>;

type AutomationMap = Record<string, AutomationMapEntry>;
type AutomationMapsOutput = Record<string, AutomationMap>;

interface RankingEntry {
  rank: number;
  constraints: string;
}
type RankingOutput = Record<string, RankingEntry>;

interface ReadinessOutput {
  topCandidateId: string;
  dossierNote: string;
  dossierReviewed: boolean;
}

function emptyPillarScores(): Record<PillarId, number> {
  return PILLAR_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: 0 }),
    {} as Record<PillarId, number>,
  );
}

function seedCandidates(): CandidatesOutput {
  return M09_OCR_CONTENT.candidateTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    owner: "",
  }));
}

function seedScores(candidates: CandidatesOutput): ScoresOutput {
  const out: ScoresOutput = {};
  for (const c of candidates) {
    const template = M09_OCR_CONTENT.candidateTemplates.find((t) => t.id === c.id);
    out[c.id] = {
      scores: emptyPillarScores(),
      reasonCodes: template ? [...template.defaultReasonCodes] : [],
    };
  }
  return out;
}

function seedAutomationMaps(candidates: CandidatesOutput): AutomationMapsOutput {
  const out: AutomationMapsOutput = {};
  for (const c of candidates) {
    const m: AutomationMap = {};
    for (const s of M09_OCR_CONTENT.automationStepTemplates) {
      m[s.id] = { level: "", humanControl: "" };
    }
    out[c.id] = m;
  }
  return out;
}

function seedRanking(candidates: CandidatesOutput): RankingOutput {
  const out: RankingOutput = {};
  for (const c of candidates) {
    out[c.id] = { rank: 0, constraints: "" };
  }
  return out;
}

function avgScore(s: Record<PillarId, number>): number {
  const vals = PILLAR_IDS.map((id) => s[id] ?? 0).filter((n) => n > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function M09Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m09");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const candidatesOut = useAssessOutput<CandidatesOutput>("m09.candidates");
  const scoresOut = useAssessOutput<ScoresOutput>("m09.scores");
  const mapsOut = useAssessOutput<AutomationMapsOutput>("m09.automation_maps");
  const rankingOut = useAssessOutput<RankingOutput>("m09.ranking");
  const readinessOut = useAssessOutput<ReadinessOutput>("m09.readiness");

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
    () => getM09PortfolioScaffold(profileContext),
    [profileContext],
  );

  const [step, setStep] = useState<StepNum>(1);
  const [candidates, setCandidates] = useState<CandidatesOutput>(seedCandidates);
  const [scores, setScores] = useState<ScoresOutput>(() => seedScores(seedCandidates()));
  const [maps, setMaps] = useState<AutomationMapsOutput>(() =>
    seedAutomationMaps(seedCandidates()),
  );
  const [ranking, setRanking] = useState<RankingOutput>(() => seedRanking(seedCandidates()));
  const [readiness, setReadiness] = useState<ReadinessOutput>({
    topCandidateId: "",
    dossierNote: "",
    dossierReviewed: false,
  });

  const [hydrated, setHydrated] = useState({
    step: false,
    candidates: false,
    scores: false,
    maps: false,
    ranking: false,
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

  // Hydrate candidates
  useEffect(() => {
    if (hydrated.candidates || candidatesOut.isLoading) return;
    if (Array.isArray(candidatesOut.value) && candidatesOut.value.length === 4) {
      setCandidates(
        candidatesOut.value.map((c, i) => ({
          id:
            typeof c.id === "string" && c.id.length > 0
              ? c.id
              : (M09_OCR_CONTENT.candidateTemplates[i]?.id ?? `c${i}`),
          name: typeof c.name === "string" ? c.name : "",
          description: typeof c.description === "string" ? c.description : "",
          owner: typeof c.owner === "string" ? c.owner : "",
        })),
      );
    }
    setHydrated((h) => ({ ...h, candidates: true }));
  }, [hydrated.candidates, candidatesOut.isLoading, candidatesOut.value]);

  // Hydrate scores
  useEffect(() => {
    if (hydrated.scores || scoresOut.isLoading) return;
    if (scoresOut.value && typeof scoresOut.value === "object") {
      const seeded = seedScores(candidates);
      const v = scoresOut.value as Partial<ScoresOutput>;
      for (const c of candidates) {
        const entry = v[c.id];
        if (entry) {
          if (entry.scores) {
            for (const pid of PILLAR_IDS) {
              const s = entry.scores[pid];
              if (typeof s === "number" && s >= 1 && s <= 5) seeded[c.id].scores[pid] = s;
            }
          }
          if (Array.isArray(entry.reasonCodes)) {
            seeded[c.id].reasonCodes = entry.reasonCodes.filter(
              (x): x is string => typeof x === "string",
            );
          }
        }
      }
      setScores(seeded);
    } else {
      setScores(seedScores(candidates));
    }
    setHydrated((h) => ({ ...h, scores: true }));
  }, [hydrated.scores, scoresOut.isLoading, scoresOut.value, candidates]);

  // Hydrate maps
  useEffect(() => {
    if (hydrated.maps || mapsOut.isLoading) return;
    if (mapsOut.value && typeof mapsOut.value === "object") {
      const seeded = seedAutomationMaps(candidates);
      const v = mapsOut.value as Partial<AutomationMapsOutput>;
      for (const c of candidates) {
        const m = v[c.id];
        if (m) {
          for (const s of M09_OCR_CONTENT.automationStepTemplates) {
            const e = m[s.id];
            if (e) {
              const lvl = e.level;
              seeded[c.id][s.id] = {
                level:
                  lvl === "manual" || lvl === "assist" || lvl === "automate" || lvl === "forbidden"
                    ? lvl
                    : "",
                humanControl: typeof e.humanControl === "string" ? e.humanControl : "",
              };
            }
          }
        }
      }
      setMaps(seeded);
    } else {
      setMaps(seedAutomationMaps(candidates));
    }
    setHydrated((h) => ({ ...h, maps: true }));
  }, [hydrated.maps, mapsOut.isLoading, mapsOut.value, candidates]);

  // Hydrate ranking
  useEffect(() => {
    if (hydrated.ranking || rankingOut.isLoading) return;
    if (rankingOut.value && typeof rankingOut.value === "object") {
      const seeded = seedRanking(candidates);
      const v = rankingOut.value as Partial<RankingOutput>;
      for (const c of candidates) {
        const e = v[c.id];
        if (e) {
          seeded[c.id] = {
            rank: typeof e.rank === "number" && e.rank >= 1 && e.rank <= 4 ? e.rank : 0,
            constraints: typeof e.constraints === "string" ? e.constraints : "",
          };
        }
      }
      setRanking(seeded);
    } else {
      setRanking(seedRanking(candidates));
    }
    setHydrated((h) => ({ ...h, ranking: true }));
  }, [hydrated.ranking, rankingOut.isLoading, rankingOut.value, candidates]);

  // Hydrate readiness
  useEffect(() => {
    if (hydrated.readiness || readinessOut.isLoading) return;
    if (readinessOut.value && typeof readinessOut.value === "object") {
      const v = readinessOut.value as Partial<ReadinessOutput>;
      setReadiness({
        topCandidateId: typeof v.topCandidateId === "string" ? v.topCandidateId : "",
        dossierNote:
          typeof v.dossierNote === "string" && v.dossierNote.length > 0
            ? v.dossierNote
            : scaffold.gate3Dossier,
        dossierReviewed: !!v.dossierReviewed,
      });
    } else {
      setReadiness({
        topCandidateId: "",
        dossierNote: scaffold.gate3Dossier,
        dossierReviewed: false,
      });
    }
    setHydrated((h) => ({ ...h, readiness: true }));
  }, [hydrated.readiness, readinessOut.isLoading, readinessOut.value, scaffold]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM09 = async () => {
    if (!user || !workspace) return;
    // Persist the generated synthesis if the user did not override it.
    const top = candidates.find((c) => c.id === readiness.topCandidateId)
      ?? candidates.find((c) => ranking[c.id]?.rank === 1);
    const topScoresLocal = top ? scores[top.id] : undefined;
    const topRankLocal = top ? ranking[top.id] : undefined;
    const topMapLocal = top ? maps[top.id] : undefined;
    const generated = top
      ? [
          `Top candidate: ${top.name} (owner: ${top.owner || "—"}).`,
          top.description ? `Scope: ${top.description}` : null,
          topScoresLocal
            ? `Average pillar score: ${avgScore(topScoresLocal.scores).toFixed(2)}.`
            : null,
          topScoresLocal && topScoresLocal.reasonCodes.length > 0
            ? `Reason codes: ${topScoresLocal.reasonCodes.join(", ")}.`
            : null,
          topRankLocal?.constraints ? `Constraints: ${topRankLocal.constraints}` : null,
          topMapLocal
            ? `Automation posture: ${M09_OCR_CONTENT.automationStepTemplates
                .map(
                  (tpl) =>
                    `${tpl.label}=${topMapLocal[tpl.id]?.level || "—"}${
                      topMapLocal[tpl.id]?.humanControl
                        ? ` (${topMapLocal[tpl.id]?.humanControl})`
                        : ""
                    }`,
                )
                .join("; ")}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";
    const finalReadiness =
      readiness.dossierNote.trim() && readiness.dossierNote !== scaffold.gate3Dossier
        ? readiness
        : { ...readiness, dossierNote: generated || scaffold.gate3Dossier };
    setReadiness(finalReadiness);
    await readinessOut.setValue.mutateAsync(finalReadiness);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m09",
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
      toast.error("Could not complete M09. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m09"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M09 complete. Gate 3 dossier is ready.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId/gate",
      params: { workspaceSlug: workspace.slug, moduleId: "m09" },
    });
  };

  if (!workspace) return null;

  // ===== STEP 1 — capture candidates =====
  if (step === 1) {
    const s = M09_OCR_CONTENT.step1;
    const allFilled = candidates.every(
      (c) => c.name.trim() !== "" && c.owner.trim() !== "",
    );

    return (
      <Step
        storyHeader={M09_OCR_CONTENT.storyHeader}
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
          <div className="space-y-4">
            <p className="text-[13px] text-slate">{scaffold.candidatePrompts}</p>
            {candidates.map((c, i) => (
              <div key={c.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-2">
                <p className="eyebrow-muted">CANDIDATE {i + 1}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Name</p>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => {
                        const next = candidates.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        );
                        setCandidates(next);
                        candidatesOut.setValue.mutate(next);
                      }}
                      className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate">Owner</p>
                    <input
                      type="text"
                      value={c.owner}
                      onChange={(e) => {
                        const next = candidates.map((x, j) =>
                          j === i ? { ...x, owner: e.target.value } : x,
                        );
                        setCandidates(next);
                        candidatesOut.setValue.mutate(next);
                      }}
                      placeholder="One named person"
                      className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                    />
                  </div>
                </div>
                <details className="group rounded-md border border-chalk bg-paper">
                  <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
                    Advanced edit — description (optional)
                  </summary>
                  <div className="p-3 pt-2">
                    <textarea
                      value={c.description}
                      onChange={(e) => {
                        const next = candidates.map((x, j) =>
                          j === i ? { ...x, description: e.target.value } : x,
                        );
                        setCandidates(next);
                        candidatesOut.setValue.mutate(next);
                      }}
                      rows={2}
                      placeholder="Pre-filled from the reference template — edit only if needed."
                      className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                    />
                  </div>
                </details>
              </div>
            ))}
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allFilled}
        disabledReason="Every candidate needs a name and a named owner."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await candidatesOut.setValue.mutateAsync(candidates);
          await goToStep(2);
        }}
      />
    );
  }

  // ===== STEP 2 — scoring =====
  if (step === 2) {
    const s = M09_OCR_CONTENT.step2;
    const allScored = candidates.every((c) => {
      const sc = scores[c.id];
      if (!sc) return false;
      return PILLAR_IDS.every((p) => sc.scores[p] >= 1 && sc.scores[p] <= 5);
    });
    const allCoded = candidates.every((c) => (scores[c.id]?.reasonCodes ?? []).length >= 1);
    const canContinue = allScored && allCoded;

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
            <p className="text-[13px] text-slate">{scaffold.scoringGuidance}</p>
            {candidates.map((c) => {
              const sc = scores[c.id] ?? { scores: emptyPillarScores(), reasonCodes: [] };
              return (
                <div key={c.id} className="rounded-md border border-chalk bg-white px-3 py-3 space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{c.name}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate">
                      avg · {avgScore(sc.scores).toFixed(2)}
                    </p>
                  </div>
                  <ScoringPillarGrid
                    pillars={M09_OCR_CONTENT.pillars}
                    value={sc.scores}
                    onChange={(pid, n) => {
                      const next: ScoresOutput = {
                        ...scores,
                        [c.id]: {
                          ...sc,
                          scores: { ...sc.scores, [pid]: n },
                        },
                      };
                      setScores(next);
                      scoresOut.setValue.mutate(next);
                    }}
                  />
                  <div className="space-y-1">
                    <p className="eyebrow-muted">REASON CODES</p>
                    <ReasonCodePicker
                      codes={M09_OCR_CONTENT.reasonCodes}
                      selected={sc.reasonCodes}
                      onToggle={(id) => {
                        const has = sc.reasonCodes.includes(id);
                        const nextCodes = has
                          ? sc.reasonCodes.filter((r) => r !== id)
                          : [...sc.reasonCodes, id];
                        const next: ScoresOutput = {
                          ...scores,
                          [c.id]: { ...sc, reasonCodes: nextCodes },
                        };
                        setScores(next);
                        scoresOut.setValue.mutate(next);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Score every pillar 1-5 for all 4 candidates and pick at least one reason code each."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await scoresOut.setValue.mutateAsync(scores);
          await goToStep(3);
        }}
      />
    );
  }

  // ===== STEP 3 — automation maps =====
  if (step === 3) {
    const s = M09_OCR_CONTENT.step3;
    const allMapped = candidates.every((c) => {
      const m = maps[c.id];
      if (!m) return false;
      return M09_OCR_CONTENT.automationStepTemplates.every((t) => {
        const e = m[t.id];
        return !!e && e.level !== "";
      });
    });

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
            {candidates.map((c) => {
              const m = maps[c.id] ?? {};
              return (
                <div key={c.id} className="space-y-2">
                  <p className="eyebrow-muted">{c.name.toUpperCase()}</p>
                  <AutomationMapEditor
                    steps={M09_OCR_CONTENT.automationStepTemplates}
                    value={m}
                    onChange={(stepId, entry) => {
                      const next: AutomationMapsOutput = {
                        ...maps,
                        [c.id]: { ...m, [stepId]: entry },
                      };
                      setMaps(next);
                      mapsOut.setValue.mutate(next);
                    }}
                  />
                </div>
              );
            })}
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allMapped}
        disabledReason="Pick an automation level for every step of every candidate."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await mapsOut.setValue.mutateAsync(maps);
          await goToStep(4);
        }}
      />
    );
  }

  // ===== STEP 4 — ranking =====
  if (step === 4) {
    const s = M09_OCR_CONTENT.step4;
    const rows = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      avgScore: avgScore(scores[c.id]?.scores ?? emptyPillarScores()),
      rank: ranking[c.id]?.rank ?? 0,
      constraints: ranking[c.id]?.constraints ?? "",
    }));
    const ranks = rows.map((r) => r.rank).filter((n) => n >= 1);
    const uniqueRanks = new Set(ranks);
    const hasAllRanks = uniqueRanks.size === 4 && [1, 2, 3, 4].every((n) => uniqueRanks.has(n));

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
          <PortfolioRankingTable
            rows={rows}
            onRankChange={(id, rank) => {
              const next: RankingOutput = {
                ...ranking,
                [id]: { ...ranking[id], rank, constraints: ranking[id]?.constraints ?? "" },
              };
              setRanking(next);
              rankingOut.setValue.mutate(next);
            }}
            onConstraintsChange={(id, text) => {
              const next: RankingOutput = {
                ...ranking,
                [id]: { ...ranking[id], rank: ranking[id]?.rank ?? 0, constraints: text },
              };
              setRanking(next);
              rankingOut.setValue.mutate(next);
            }}
          />
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={hasAllRanks}
        disabledReason="Assign unique ranks 1-4 across the four candidates."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(3)}
        onContinue={async () => {
          await rankingOut.setValue.mutateAsync(ranking);
          // Pre-fill top candidate
          const top = candidates.find((c) => ranking[c.id]?.rank === 1);
          if (top && readiness.topCandidateId === "") {
            const next = { ...readiness, topCandidateId: top.id };
            setReadiness(next);
            readinessOut.setValue.mutate(next);
          }
          await goToStep(5);
        }}
      />
    );
  }

  // ===== STEP 5 — Gate 3 dossier =====
  const s = M09_OCR_CONTENT.step5;
  const top = candidates.find((c) => c.id === readiness.topCandidateId)
    ?? candidates.find((c) => ranking[c.id]?.rank === 1);
  const topScores = top ? scores[top.id] : undefined;
  const topRank = top ? ranking[top.id] : undefined;
  const topMap = top ? maps[top.id] : undefined;
  const canComplete = !!top && readiness.dossierReviewed;

  const generatedDossier = top
    ? [
        `Top candidate: ${top.name} (owner: ${top.owner || "—"}).`,
        top.description ? `Scope: ${top.description}` : null,
        topScores
          ? `Average pillar score: ${avgScore(topScores.scores).toFixed(2)}.`
          : null,
        topScores && topScores.reasonCodes.length > 0
          ? `Reason codes: ${topScores.reasonCodes.join(", ")}.`
          : null,
        topRank?.constraints ? `Constraints: ${topRank.constraints}` : null,
        topMap
          ? `Automation posture: ${M09_OCR_CONTENT.automationStepTemplates
              .map(
                (tpl) =>
                  `${tpl.label}=${topMap[tpl.id]?.level || "—"}${
                    topMap[tpl.id]?.humanControl
                      ? ` (${topMap[tpl.id]?.humanControl})`
                      : ""
                  }`,
              )
              .join("; ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "";





  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 5 of 5 · GATE 3 DOSSIER"
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
            <p className="eyebrow-muted">WORKED EXAMPLE</p>
            <p className="text-[13px] text-navy">{scaffold.workedExampleName}</p>
          </div>

          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2">
            <p className="eyebrow-muted">TOP CANDIDATE</p>
            {top ? (
              <>
                <p className="text-[13px] text-navy">
                  <span className="font-medium">{top.name}</span> — owner: {top.owner || "—"}
                </p>
                <p className="text-[12px] text-slate">{top.description}</p>
                <p className="text-[12px] text-navy">
                  <span className="font-medium">Avg score:</span>{" "}
                  {topScores ? avgScore(topScores.scores).toFixed(2) : "—"}
                </p>
                <p className="text-[12px] text-navy">
                  <span className="font-medium">Reason codes:</span>{" "}
                  {topScores && topScores.reasonCodes.length > 0
                    ? topScores.reasonCodes.join(", ")
                    : "—"}
                </p>
                <p className="text-[12px] text-navy">
                  <span className="font-medium">Constraints:</span>{" "}
                  {topRank?.constraints || "—"}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-slate">No rank-1 candidate selected.</p>
            )}
          </div>

          {top && topMap && (
            <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1">
              <p className="eyebrow-muted">AUTOMATION POSTURE — {top.name.toUpperCase()}</p>
              <ul className="text-[12px] text-navy">
                {M09_OCR_CONTENT.automationStepTemplates.map((tpl) => (
                  <li key={tpl.id}>
                    <span className="font-medium">{tpl.label}:</span>{" "}
                    {topMap[tpl.id]?.level || "—"}
                    {topMap[tpl.id]?.humanControl
                      ? ` · ${topMap[tpl.id]?.humanControl}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md border border-chalk bg-white px-4 py-3 space-y-1">
            <p className="eyebrow-muted">GATE 3 CRITERIA</p>
            <ul className="list-disc pl-5 text-[12px] text-slate">
              {M09_OCR_CONTENT.gate3Criteria.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-navy">{c.label}:</span> {c.question}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="eyebrow-muted">DOSSIER SYNTHESIS — GENERATED</p>
            <div className="rounded-md border border-chalk bg-paper px-3 py-2 text-[13px] leading-relaxed text-navy whitespace-pre-wrap">
              {(readiness.dossierNote.trim() && readiness.dossierNote !== scaffold.gate3Dossier)
                ? readiness.dossierNote
                : (generatedDossier || scaffold.gate3Dossier)}
            </div>
            <details className="group rounded-md border border-chalk bg-paper">
              <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
                Advanced edit — override synthesis (optional)
              </summary>
              <div className="p-3 pt-2">
                <textarea
                  value={readiness.dossierNote}
                  onChange={(e) => {
                    const next = { ...readiness, dossierNote: e.target.value };
                    setReadiness(next);
                    readinessOut.setValue.mutate(next);
                  }}
                  rows={6}
                  placeholder={generatedDossier}
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
                />
              </div>
            </details>
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
            I have reviewed the dossier above end-to-end and it is the version I will bring to Gate 3.
          </label>

          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M09_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canComplete}
      disabledReason="Acknowledge dossier review and confirm a top candidate."
      nextLabel="Complete M09 → Gate 3"
      onBack={() => goToStep(4)}
      onContinue={completeM09}
    />
  );
}

export function M09WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m09" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
