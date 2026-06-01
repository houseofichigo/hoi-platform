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
import { PromptBlock } from "@/components/assess/PromptBlock";
import { AssistantArchitectureMap } from "@/components/assess/AssistantArchitectureMap";
import { KnowledgeArtifactList } from "@/components/assess/KnowledgeArtifactList";
import { RAGGovernanceCards } from "@/components/assess/RAGGovernanceCards";
import { AssistantTestCaseList } from "@/components/assess/AssistantTestCaseList";
import {
  M04_OCR_CONTENT,
  getM04AssistantScaffold,
  type KnowledgeArtifactId,
  type RagDimensionId,
  type AssistantTestId,
} from "@/lib/worked-examples/invoice-ocr/m04";

const CHAPTER_LABEL = "PHASE 02 · M04 · AI ASSISTANTS & RAG";
const TOTAL_STEPS = 5;

type StepNum = 1 | 2 | 3 | 4 | 5;

type ArtifactCheckId = "produced";

interface ArchitectureOutput {
  acknowledged: boolean;
}

type KnowledgeOutput = Record<KnowledgeArtifactId, { produced: boolean }>;
type GovernanceChoice = "good" | "weak" | "";
type GovernanceOutput = Record<RagDimensionId, GovernanceChoice>;

type TestVerdict = "pass" | "partial" | "fail" | "";
type TestResultEntry = { verdicts: TestVerdict[]; note: string };
type TestResultsOutput = Record<AssistantTestId, TestResultEntry>;

interface ReadinessOutput {
  responses: Record<string, "yes" | "partial" | "no">;
  acknowledged: boolean;
}

const ARTIFACT_IDS: readonly KnowledgeArtifactId[] = ["schema", "context", "mock"];
const GOVERNANCE_IDS: readonly RagDimensionId[] = ["indexing", "access", "retention", "change"];
const TEST_IDS: readonly AssistantTestId[] = [
  "schema_lookup",
  "context_rule",
  "mock_extraction",
  "uncertainty",
  "injection_refusal",
];
const READINESS_IDS = M04_OCR_CONTENT.gateReadinessCriteria.map((c) => c.id);

function buildKnowledgeDefaults(): KnowledgeOutput {
  return {
    schema: { produced: false },
    context: { produced: false },
    mock: { produced: false },
  };
}

function buildGovernanceDefaults(): GovernanceOutput {
  return { indexing: "", access: "", retention: "", change: "" };
}

function buildTestDefaults(): TestResultsOutput {
  const out = {} as TestResultsOutput;
  for (const id of TEST_IDS) {
    const tc = M04_OCR_CONTENT.testCases.find((t) => t.id === id)!;
    out[id] = { verdicts: tc.passCriteria.map(() => "" as TestVerdict), note: "" };
  }
  return out;
}

function buildReadinessDefaults(): ReadinessOutput {
  return { responses: {}, acknowledged: false };
}

function isKnowledgeComplete(v: KnowledgeOutput) {
  return ARTIFACT_IDS.every((id) => v[id]?.produced);
}
function isGovernanceComplete(v: GovernanceOutput) {
  return GOVERNANCE_IDS.every((id) => v[id] === "good" || v[id] === "weak");
}
function isTestsComplete(v: TestResultsOutput) {
  return TEST_IDS.every((id) => v[id]?.verdicts.every((x) => x !== ""));
}
function isReadinessComplete(v: ReadinessOutput) {
  return v.acknowledged && READINESS_IDS.every((id) => !!v.responses[id]);
}

// silence unused warning
void (null as unknown as ArtifactCheckId);

export function M04Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m04");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const architectureOut = useAssessOutput<ArchitectureOutput>("m04.architecture");
  const knowledgeOut = useAssessOutput<KnowledgeOutput>("m04.knowledge_base");
  const governanceOut = useAssessOutput<GovernanceOutput>("m04.rag_governance");
  const testsOut = useAssessOutput<TestResultsOutput>("m04.test_results");
  const readinessOut = useAssessOutput<ReadinessOutput>("m04.readiness");

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

  const scaffold = useMemo(() => getM04AssistantScaffold(profileContext), [profileContext]);

  const [step, setStep] = useState<StepNum>(1);
  const [architecture, setArchitecture] = useState<ArchitectureOutput>({ acknowledged: false });
  const [knowledge, setKnowledge] = useState<KnowledgeOutput>(buildKnowledgeDefaults());
  const [governance, setGovernance] = useState<GovernanceOutput>(buildGovernanceDefaults());
  const [tests, setTests] = useState<TestResultsOutput>(buildTestDefaults());
  const [readiness, setReadiness] = useState<ReadinessOutput>(buildReadinessDefaults());

  const [hydrated, setHydrated] = useState({
    step: false,
    architecture: false,
    knowledge: false,
    governance: false,
    tests: false,
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

  // Hydrators
  useEffect(() => {
    if (hydrated.architecture || architectureOut.isLoading) return;
    if (architectureOut.value && typeof architectureOut.value === "object") {
      setArchitecture({ acknowledged: !!architectureOut.value.acknowledged });
    }
    setHydrated((h) => ({ ...h, architecture: true }));
  }, [hydrated.architecture, architectureOut.isLoading, architectureOut.value]);

  useEffect(() => {
    if (hydrated.knowledge || knowledgeOut.isLoading) return;
    if (knowledgeOut.value && typeof knowledgeOut.value === "object") {
      const v = knowledgeOut.value as Partial<KnowledgeOutput>;
      const merged = buildKnowledgeDefaults();
      for (const id of ARTIFACT_IDS) {
        if (v[id]) merged[id] = { produced: !!v[id]!.produced };
      }
      setKnowledge(merged);
    }
    setHydrated((h) => ({ ...h, knowledge: true }));
  }, [hydrated.knowledge, knowledgeOut.isLoading, knowledgeOut.value]);

  useEffect(() => {
    if (hydrated.governance || governanceOut.isLoading) return;
    if (governanceOut.value && typeof governanceOut.value === "object") {
      const v = governanceOut.value as Partial<GovernanceOutput>;
      const merged = buildGovernanceDefaults();
      for (const id of GOVERNANCE_IDS) {
        if (v[id] === "good" || v[id] === "weak") merged[id] = v[id]!;
      }
      setGovernance(merged);
    }
    setHydrated((h) => ({ ...h, governance: true }));
  }, [hydrated.governance, governanceOut.isLoading, governanceOut.value]);

  useEffect(() => {
    if (hydrated.tests || testsOut.isLoading) return;
    if (testsOut.value && typeof testsOut.value === "object") {
      const v = testsOut.value as Partial<TestResultsOutput>;
      const merged = buildTestDefaults();
      for (const id of TEST_IDS) {
        const entry = v[id];
        if (entry && Array.isArray(entry.verdicts)) {
          const base = merged[id];
          merged[id] = {
            verdicts: base.verdicts.map((_, i) => {
              const raw = entry.verdicts[i];
              return raw === "pass" || raw === "partial" || raw === "fail" ? raw : "";
            }),
            note: typeof entry.note === "string" ? entry.note : "",
          };
        }
      }
      setTests(merged);
    }
    setHydrated((h) => ({ ...h, tests: true }));
  }, [hydrated.tests, testsOut.isLoading, testsOut.value]);

  useEffect(() => {
    if (hydrated.readiness || readinessOut.isLoading) return;
    if (readinessOut.value && typeof readinessOut.value === "object") {
      const v = readinessOut.value as Partial<ReadinessOutput>;
      setReadiness({
        responses: (v.responses ?? {}) as ReadinessOutput["responses"],
        acknowledged: !!v.acknowledged,
      });
    }
    setHydrated((h) => ({ ...h, readiness: true }));
  }, [hydrated.readiness, readinessOut.isLoading, readinessOut.value]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM04 = async () => {
    if (!user || !workspace) return;
    await readinessOut.setValue.mutateAsync(readiness);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m04",
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
      toast.error("Could not complete M04. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m04"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M04 complete. Gate 1 is ready.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId/gate",
      params: { workspaceSlug: workspace.slug, moduleId: "m04" },
    });
  };

  if (!workspace) return null;

  // ============ STEP 1 — Architecture ============
  if (step === 1) {
    const s = M04_OCR_CONTENT.step1;
    return (
      <Step
        storyHeader={M04_OCR_CONTENT.storyHeader}
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
            <AssistantArchitectureMap blocks={M04_OCR_CONTENT.architectureBlocks} />

            <div className="space-y-4">
              <p className="eyebrow-muted">PROFILE-DRIVEN SCAFFOLD — COPY INTO YOUR ASSISTANT</p>
              <PromptBlock label="System prompt" text={scaffold.systemPrompt} />
              <PromptBlock label="Knowledge instructions" text={scaffold.knowledgeInstructions} />
              <PromptBlock label="Retrieval rules" text={scaffold.retrievalRules} />
              <PromptBlock label="Refusal rules" text={scaffold.refusalRules} />
            </div>

            <label className="inline-flex cursor-pointer items-start gap-2 text-[14px] text-navy">
              <input
                type="checkbox"
                checked={architecture.acknowledged}
                onChange={(e) => setArchitecture({ acknowledged: e.target.checked })}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              I understand the five architecture blocks and have copied the scaffold into my
              assistant.
            </label>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={architecture.acknowledged}
        disabledReason="Acknowledge the five blocks before continuing."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await architectureOut.setValue.mutateAsync(architecture);
          await goToStep(2);
        }}
      />
    );
  }

  // ============ STEP 2 — Knowledge base ============
  if (step === 2) {
    const s = M04_OCR_CONTENT.step2;
    const allProduced = isKnowledgeComplete(knowledge);

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
          <div className="space-y-4">
            <KnowledgeArtifactList artifacts={M04_OCR_CONTENT.knowledgeArtifacts} />
            <ul className="space-y-2">
              {M04_OCR_CONTENT.knowledgeArtifacts.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                    <input
                      type="checkbox"
                      checked={knowledge[a.id].produced}
                      onChange={(e) => {
                        const next = {
                          ...knowledge,
                          [a.id]: { produced: e.target.checked },
                        };
                        setKnowledge(next);
                        knowledgeOut.setValue.mutate(next);
                      }}
                      className="mt-1 h-4 w-4 accent-terracotta"
                    />
                    <span>
                      <span className="font-medium">{a.title}</span> is produced, quality-checked,
                      and ready to load into the assistant.
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allProduced}
        disabledReason="Confirm all three artifacts are produced."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await knowledgeOut.setValue.mutateAsync(knowledge);
          await goToStep(3);
        }}
      />
    );
  }

  // ============ STEP 3 — RAG governance ============
  if (step === 3) {
    const s = M04_OCR_CONTENT.step3;
    const allChosen = isGovernanceComplete(governance);

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
            <RAGGovernanceCards dimensions={M04_OCR_CONTENT.ragGovernance} />

            <div className="space-y-3">
              <p className="text-sm font-medium text-navy">
                Pick the posture you will operate with for each dimension.
              </p>
              <ul className="space-y-2">
                {M04_OCR_CONTENT.ragGovernance.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-md border border-chalk bg-white px-3 py-2 flex flex-wrap items-center gap-3"
                  >
                    <span className="text-sm font-medium text-navy w-28 shrink-0">{d.title}</span>
                    {(["good", "weak"] as const).map((choice) => {
                      const selected = governance[d.id] === choice;
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => {
                            const next = { ...governance, [d.id]: choice };
                            setGovernance(next);
                            governanceOut.setValue.mutate(next);
                          }}
                          className={`rounded-full px-3 py-1 text-[12px] font-mono uppercase tracking-[0.16em] transition-colors ${
                            selected
                              ? choice === "good"
                                ? "bg-terracotta text-white"
                                : "bg-navy text-white"
                              : "bg-mist text-slate hover:bg-mist/70"
                          }`}
                        >
                          {choice === "good" ? "Good default" : "Weak default"}
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
        disabledReason="Pick a posture for all four governance dimensions."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await governanceOut.setValue.mutateAsync(governance);
          await goToStep(4);
        }}
      />
    );
  }

  // ============ STEP 4 — Tests ============
  if (step === 4) {
    const s = M04_OCR_CONTENT.step4;
    const allVerdicts = isTestsComplete(tests);

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
            <AssistantTestCaseList cases={M04_OCR_CONTENT.testCases} />

            <div className="space-y-4">
              <p className="text-sm font-medium text-navy">
                Record a verdict against each pass criterion.
              </p>
              {M04_OCR_CONTENT.testCases.map((tc) => {
                const entry = tests[tc.id];
                return (
                  <div
                    key={tc.id}
                    className="rounded-md border border-chalk bg-white px-4 py-3 space-y-3"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
                      TEST 0{tc.order} · {tc.title}
                    </p>
                    <ul className="space-y-2">
                      {tc.passCriteria.map((c, i) => (
                        <li key={c} className="space-y-1">
                          <p className="text-[13px] text-navy">{c}</p>
                          <div className="flex gap-2">
                            {(["pass", "partial", "fail"] as const).map((v) => {
                              const selected = entry.verdicts[i] === v;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => {
                                    const verdicts = entry.verdicts.slice();
                                    verdicts[i] = v;
                                    const next = {
                                      ...tests,
                                      [tc.id]: { ...entry, verdicts },
                                    };
                                    setTests(next);
                                    testsOut.setValue.mutate(next);
                                  }}
                                  className={`rounded-full px-3 py-1 text-[12px] font-mono uppercase tracking-[0.16em] transition-colors ${
                                    selected
                                      ? v === "pass"
                                        ? "bg-terracotta text-white"
                                        : v === "partial"
                                          ? "bg-navy text-white"
                                          : "bg-graphite text-white"
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
                    <div className="space-y-1">
                      <p className="eyebrow-muted">NOTES (OPTIONAL)</p>
                      <textarea
                        value={entry.note}
                        onChange={(e) => {
                          const next = {
                            ...tests,
                            [tc.id]: { ...entry, note: e.target.value },
                          };
                          setTests(next);
                          testsOut.setValue.mutate(next);
                        }}
                        rows={2}
                        placeholder="What happened, edge cases, follow-ups…"
                        className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allVerdicts}
        disabledReason="Record a verdict for every pass criterion in all five tests."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(3)}
        onContinue={async () => {
          await testsOut.setValue.mutateAsync(tests);
          await goToStep(5);
        }}
      />
    );
  }

  // ============ STEP 5 — Readiness dossier ============
  const s = M04_OCR_CONTENT.step5;
  const dossierReady = isReadinessComplete(readiness);

  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 5 of 5 · GATE 1 DOSSIER"
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
          <div className="card bg-mist/40 space-y-2">
            <p className="eyebrow-muted">TEST PLAN SUMMARY</p>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-navy">
              {scaffold.testPlanSummary}
            </pre>
          </div>

          <ul className="space-y-3">
            {M04_OCR_CONTENT.gateReadinessCriteria.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  {c.label.toUpperCase()}
                </p>
                <p className="text-[14px] text-navy">{c.question}</p>
                <div className="flex gap-2">
                  {(["yes", "partial", "no"] as const).map((v) => {
                    const selected = readiness.responses[c.id] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          const next: ReadinessOutput = {
                            ...readiness,
                            responses: { ...readiness.responses, [c.id]: v },
                          };
                          setReadiness(next);
                          readinessOut.setValue.mutate(next);
                        }}
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

          <label className="inline-flex cursor-pointer items-start gap-2 text-[14px] text-navy">
            <input
              type="checkbox"
              checked={readiness.acknowledged}
              onChange={(e) => {
                const next = { ...readiness, acknowledged: e.target.checked };
                setReadiness(next);
                readinessOut.setValue.mutate(next);
              }}
              className="mt-1 h-4 w-4 accent-terracotta"
            />
            The dossier above is the version I will bring to Gate 1.
          </label>

          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M04_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={dossierReady}
      disabledReason="Answer all five readiness questions and confirm the dossier."
      nextLabel="Complete M04 → Gate 1"
      onBack={() => goToStep(4)}
      onContinue={completeM04}
    />
  );
}

export function M04WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m04" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
