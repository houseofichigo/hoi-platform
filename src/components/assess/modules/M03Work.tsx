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
import { PromptLadder } from "@/components/assess/PromptLadder";
import { type PromptEntryFormValue } from "@/components/assess/PromptEntryForm";
import { PromptBlock } from "@/components/assess/PromptBlock";
import {
  M03_OCR_CONTENT,
  getM03PromptScaffolds,
  type ScaffoldKey,
  type SixElementScaffold,
} from "@/lib/worked-examples/invoice-ocr/m03";

const CHAPTER_LABEL = "PHASE 01 · M03 · PROMPT ENGINEERING";
const TOTAL_STEPS = 4;

type StepNum = 1 | 2 | 3 | 4;

type PlacementId = (typeof M03_OCR_CONTENT.placementOptions)[number]["id"];
type TaskTypeId = (typeof M03_OCR_CONTENT.taskTypeOptions)[number]["id"];

interface ArchitectureOutput {
  placement: PlacementId | "";
  taskType: TaskTypeId | "";
  matchedReference: boolean;
}

type PromptEntry = PromptEntryFormValue;
type PromptsOutput = Record<ScaffoldKey, PromptEntry>;
type QualityCheckedOutput = Record<ScaffoldKey, string[]>;

const PROMPT_KEYS: readonly ScaffoldKey[] = ["schema", "context", "mock"] as const;
const QUALITY_IDS = M03_OCR_CONTENT.qualityBar.map((q) => q.id);

function buildPromptDefaults(scaffolds: Record<ScaffoldKey, SixElementScaffold>): PromptsOutput {
  return {
    schema: { ...scaffolds.schema, injectionRisk: "" },
    context: { ...scaffolds.context, injectionRisk: "" },
    mock: { ...scaffolds.mock, injectionRisk: "" },
  };
}

function buildQualityDefaults(): QualityCheckedOutput {
  return { schema: [], context: [], mock: [] };
}

function isPromptEntryComplete(entry: PromptEntry) {
  return (
    entry.task.trim().length > 0 &&
    entry.role.trim().length > 0 &&
    entry.context.trim().length > 0 &&
    entry.constraints.trim().length > 0 &&
    entry.output.trim().length > 0 &&
    entry.examples.trim().length > 0 &&
    entry.injectionRisk.trim().length > 0
  );
}

function isQualityComplete(value: QualityCheckedOutput) {
  return PROMPT_KEYS.every((key) => QUALITY_IDS.every((id) => value[key]?.includes(id)));
}

export function M03Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m03");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const architectureOut = useAssessOutput<ArchitectureOutput>("m03.architecture");
  const ladderOut = useAssessOutput<boolean>("m03.ladder_understood");
  const promptsOut = useAssessOutput<PromptsOutput>("m03.prompts");
  const qualityOut = useAssessOutput<QualityCheckedOutput>("m03.quality_checked");

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

  const scaffoldDefaults = useMemo(() => getM03PromptScaffolds(profileContext), [profileContext]);

  const [step, setStep] = useState<StepNum>(1);
  const [architecture, setArchitecture] = useState<ArchitectureOutput>({
    placement: "",
    taskType: "",
    matchedReference: false,
  });
  const [prompts, setPrompts] = useState<PromptsOutput>(() =>
    buildPromptDefaults(scaffoldDefaults),
  );
  const [qualityChecked, setQualityChecked] =
    useState<QualityCheckedOutput>(buildQualityDefaults());

  const [hydrated, setHydrated] = useState({
    step: false,
    architecture: false,
    prompts: false,
    quality: false,
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

  // Seed m03.prompts once if missing
  useEffect(() => {
    if (!user || !workspace) return;
    if (promptsOut.isLoading) return;
    if (promptsOut.value !== undefined) return;
    (async () => {
      const seed = buildPromptDefaults(scaffoldDefaults);
      const { error } = await supabase.from("assess_outputs").upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          output_key: "m03.prompts",
          value: seed as never,
          seeded: true,
          touched: false,
        },
        { onConflict: "workspace_id,user_id,output_key" },
      );
      if (!error) {
        qc.invalidateQueries({
          queryKey: ["assess-output", workspace.id, user.id, "m03.prompts"],
        });
      }
    })();
  }, [user, workspace, promptsOut.isLoading, promptsOut.value, scaffoldDefaults, qc]);

  // Hydrate architecture
  useEffect(() => {
    if (hydrated.architecture || architectureOut.isLoading) return;
    if (architectureOut.value && typeof architectureOut.value === "object") {
      const v = architectureOut.value;
      setArchitecture({
        placement: (v.placement ?? "") as ArchitectureOutput["placement"],
        taskType: (v.taskType ?? "") as ArchitectureOutput["taskType"],
        matchedReference: !!v.matchedReference,
      });
    }
    setHydrated((h) => ({ ...h, architecture: true }));
  }, [hydrated.architecture, architectureOut.isLoading, architectureOut.value]);

  // Hydrate prompts
  useEffect(() => {
    if (hydrated.prompts || promptsOut.isLoading) return;
    if (promptsOut.value && typeof promptsOut.value === "object") {
      const v = promptsOut.value as Partial<PromptsOutput>;
      const merged = buildPromptDefaults(scaffoldDefaults);
      for (const k of PROMPT_KEYS) {
        if (v[k] && typeof v[k] === "object") {
          merged[k] = { ...merged[k], ...(v[k] as PromptEntry) };
        }
      }
      setPrompts(merged);
      setHydrated((h) => ({ ...h, prompts: true }));
    }
  }, [hydrated.prompts, promptsOut.isLoading, promptsOut.value, scaffoldDefaults]);

  // Hydrate quality
  useEffect(() => {
    if (hydrated.quality || qualityOut.isLoading) return;
    if (qualityOut.value && typeof qualityOut.value === "object") {
      const v = qualityOut.value as Partial<QualityCheckedOutput>;
      setQualityChecked({
        schema: Array.isArray(v.schema) ? v.schema : [],
        context: Array.isArray(v.context) ? v.context : [],
        mock: Array.isArray(v.mock) ? v.mock : [],
      });
    }
    setHydrated((h) => ({ ...h, quality: true }));
  }, [hydrated.quality, qualityOut.isLoading, qualityOut.value]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const updatePromptFor = (key: ScaffoldKey, next: PromptEntry) => {
    const updated = { ...prompts, [key]: next };
    setPrompts(updated);
    promptsOut.setValue.mutate(updated);
  };

  const toggleQuality = (key: ScaffoldKey, itemId: string) => {
    const current = qualityChecked[key];
    const nextList = current.includes(itemId)
      ? current.filter((v) => v !== itemId)
      : [...current, itemId];
    const next = { ...qualityChecked, [key]: nextList };
    setQualityChecked(next);
    qualityOut.setValue.mutate(next);
  };

  const completeM03 = async () => {
    if (!user || !workspace) return;
    await qualityOut.setValue.mutateAsync(qualityChecked);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m03",
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
      toast.error("Could not complete M03. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m03"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M03 complete. M04 AI Assistants & RAG is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess",
      params: { workspaceSlug: workspace.slug },
    });
  };

  if (!workspace) return null;

  // ============ STEP 1 — Architecture ============
  if (step === 1) {
    const s = M03_OCR_CONTENT.step1;
    const ref = M03_OCR_CONTENT.step1ReferencePrompt;
    const bothPicked = architecture.placement !== "" && architecture.taskType !== "";
    const architectureMatches =
      architecture.placement === ref.correctPlacement &&
      architecture.taskType === ref.correctTaskType;

    return (
      <Step
        storyHeader={M03_OCR_CONTENT.storyHeader}
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
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="eyebrow">{ref.label.toUpperCase()}</p>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed bg-ink/95 text-paper rounded-md p-3 overflow-x-auto">
                {ref.text}
              </pre>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-navy">
                Question 1 — Where does this prompt live? (placement)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {M03_OCR_CONTENT.placementOptions.map((p) => (
                  <label
                    key={p.id}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      architecture.placement === p.id
                        ? "border-terracotta bg-mist/40"
                        : "border-chalk bg-white hover:bg-mist/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="placement"
                      checked={architecture.placement === p.id}
                      onChange={() =>
                        setArchitecture((a) => ({ ...a, placement: p.id, matchedReference: false }))
                      }
                      className="sr-only"
                    />
                    <p className="text-sm font-medium text-navy">{p.label}</p>
                    <p className="text-[12px] text-slate mt-0.5">{p.description}</p>
                    <p className="text-[11px] italic text-graphite mt-1">{p.bestFor}</p>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-navy">
                Question 2 — What is its primary task type?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {M03_OCR_CONTENT.taskTypeOptions.map((t) => (
                  <label
                    key={t.id}
                    className={`cursor-pointer rounded-md border p-2.5 transition-colors ${
                      architecture.taskType === t.id
                        ? "border-terracotta bg-mist/40"
                        : "border-chalk bg-white hover:bg-mist/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="taskType"
                      checked={architecture.taskType === t.id}
                      onChange={() =>
                        setArchitecture((a) => ({ ...a, taskType: t.id, matchedReference: false }))
                      }
                      className="sr-only"
                    />
                    <p className="text-sm font-medium text-navy">{t.label}</p>
                    <p className="text-[12px] text-slate">{t.description}</p>
                  </label>
                ))}
              </div>
            </div>

            {bothPicked && (
              <div className="card border-l-[3px] border-l-terracotta space-y-2">
                <p className="eyebrow-muted">REFERENCE</p>
                {architectureMatches ? (
                  <>
                    <p className="text-[13px] text-navy">
                      ✓ Match — placement is{" "}
                      <span className="font-mono">{ref.correctPlacement}</span> and task type is{" "}
                      <span className="font-mono">{ref.correctTaskType}</span>.
                    </p>
                    <p className="text-[12px] italic text-slate">{ref.rationale}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-navy">
                      Different from the reference. The reference answer is{" "}
                      <span className="font-mono">{ref.correctPlacement}</span> +{" "}
                      <span className="font-mono">{ref.correctTaskType}</span>. Re-pick before
                      continuing.
                    </p>
                    <p className="text-[12px] italic text-slate">{ref.rationale}</p>
                  </>
                )}
              </div>
            )}
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={architectureMatches}
        disabledReason="Pick User prompt + Search for the reference prompt."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await architectureOut.setValue.mutateAsync({
            ...architecture,
            matchedReference: true,
          });
          await goToStep(2);
        }}
      />
    );
  }

  // ============ STEP 2 — Ladder ============
  if (step === 2) {
    const s = M03_OCR_CONTENT.step2;
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
        yourVersion={<PromptLadder rungs={M03_OCR_CONTENT.ladder} />}
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        outputKey="m03.ladder_understood"
        ackOnly
        ackLabel="I understand how the six elements compound from V1 to V6."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={() => goToStep(3)}
      />
    );
  }

  // ============ STEP 3 — Three prompt entries ============
  if (step === 3) {
    const s = M03_OCR_CONTENT.step3;
    const allComplete = PROMPT_KEYS.every((k) => isPromptEntryComplete(prompts[k]));

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
          <div className="space-y-6">
            <div className="rounded-md border border-chalk bg-mist/40 p-3 space-y-2">
              <p className="eyebrow-muted">OPTIMIZER CHECKLIST</p>
              <ul className="flex flex-wrap gap-1.5">
                {M03_OCR_CONTENT.optimizerChecklist.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-chalk bg-white px-2 py-0.5 text-[11px] text-slate"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              {M03_OCR_CONTENT.promptAssignments.map((a) => {
                const entry = prompts[a.id];
                const assembled = M03_OCR_CONTENT.frameworkElements
                  .map((el) => `# ${el.ordinal} · ${el.label}\n${entry[el.key] ?? ""}`)
                  .join("\n\n");
                const risks = M03_OCR_CONTENT.injectionRisks[a.id];
                return (
                  <div
                    key={a.id}
                    className="rounded-md border border-chalk bg-white overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-chalk space-y-1">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
                        PROMPT 0{a.order} · {a.layer}
                      </p>
                      <p className="font-display text-navy text-base">{a.title}</p>
                      <p className="text-[12px] text-slate">
                        <span className="font-mono uppercase tracking-wider">Task type:</span>{" "}
                        {a.taskType}
                      </p>
                      <p className="text-[13px] text-navy pt-1">
                        <span className="eyebrow-muted">OUTPUT — </span>
                        {a.output}
                      </p>
                      <p className="text-[12px] text-slate italic">{a.why}</p>
                    </div>

                    <div className="px-4 py-4 space-y-3">
                      <PromptBlock
                        label="Pre-prompt — copy into your LLM"
                        text={assembled}
                      />
                    </div>

                    <div className="px-4 pb-4 pt-2 space-y-2 border-t border-chalk">
                      <p className="text-sm font-medium text-navy">
                        Pick the one prompt-injection risk you'll name in this library entry
                      </p>
                      <ul className="space-y-2">
                        {risks.map((risk) => (
                          <li key={risk}>
                            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-navy">
                              <input
                                type="radio"
                                name={`injection-${a.id}`}
                                checked={entry.injectionRisk === risk}
                                onChange={() =>
                                  updatePromptFor(a.id, { ...entry, injectionRisk: risk })
                                }
                                className="mt-1 h-4 w-4 accent-terracotta"
                              />
                              <span>{risk}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allComplete}
        disabledReason="Pick one injection risk for each of the three prompts."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={async () => {
          await promptsOut.setValue.mutateAsync(prompts);
          await goToStep(4);
        }}
      />
    );
  }

  // ============ STEP 4 — Quality bar + complete ============
  const s = M03_OCR_CONTENT.step4;
  const allChecked = isQualityComplete(qualityChecked);

  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 4 of 4 · METHOD NOTE"
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
        <div className="space-y-8">
          {M03_OCR_CONTENT.promptAssignments.map((a) => {
            const entry = prompts[a.id];
            const checked = qualityChecked[a.id];
            return (
              <div key={a.id} className="card space-y-5">
                <header>
                  <p className="eyebrow">{a.layer.toUpperCase()}</p>
                  <h3 className="font-display text-navy text-lg">
                    {a.order}. {a.title}
                  </h3>
                  <p className="text-[12px] text-slate mt-1">
                    Task type: {a.taskType} · {checked.length} / {QUALITY_IDS.length} quality items
                  </p>
                </header>

                <details className="rounded border border-chalk bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-navy hover:bg-mist/30">
                    Show prompt summary
                  </summary>
                  <div className="space-y-3 border-t border-chalk px-3 py-3">
                    {M03_OCR_CONTENT.frameworkElements.map((el) => (
                      <div key={el.key} className="space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                          {el.ordinal} · {el.label}
                        </p>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-graphite">
                          {entry[el.key]}
                        </pre>
                      </div>
                    ))}
                    <div className="space-y-1 border-t border-chalk pt-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                        INJECTION RISK
                      </p>
                      <p className="text-[12px] text-graphite">{entry.injectionRisk}</p>
                    </div>
                  </div>
                </details>

                <ul className="space-y-2">
                  {M03_OCR_CONTENT.qualityBar.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked.includes(item.id)}
                          onChange={() => toggleQuality(a.id, item.id)}
                          className="mt-1 h-4 w-4 accent-terracotta"
                        />
                        <span>
                          <span className="text-sm font-medium text-navy">{item.label}</span>
                          <span className="block text-[12px] text-slate">{item.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M03_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={allChecked}
      disabledReason="Confirm all 10 quality items for each of the three prompts."
      nextLabel="Complete M03"
      onBack={() => goToStep(3)}
      onContinue={completeM03}
    />
  );
}

export function M03WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m03" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
