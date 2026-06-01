import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAssessProgress, useAssessOutput } from "@/hooks/useAssess";
import { supabase } from "@/integrations/supabase/client";
import { Step } from "@/components/assess/Step";
import { PromptBlock } from "@/components/assess/PromptBlock";
import { TokenizerLab } from "@/components/assess/TokenizerLab";
import { M01_OCR_CONTENT, getM01DangerousTaskOptions } from "@/lib/worked-examples/invoice-ocr/m01";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { useUseCaseProfile } from "@/hooks/useUseCaseProfile";

const TOKEN_OBSERVATIONS = [
  "Longer context increases cost.",
  "Instructions count as tokens too.",
  "Examples count as tokens too.",
  "Output length affects cost.",
  "Messy OCR can increase token usage.",
  "Repeated context can waste budget.",
] as const;

const TOKEN_STRATEGIES = [
  "Send only relevant context.",
  "Summarize long documents first.",
  "Use retrieval instead of pasting everything.",
  "Set output length expectations.",
  "Remove duplicate text.",
  "Cache repeated analysis.",
] as const;

interface TokenAwareness {
  observations: string[];
  strategies: string[];
  acknowledged: boolean;
}

const CHAPTER_LABEL = "PHASE 01 · M01 · LLM FUNDAMENTALS";

export function M01Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const progress = useAssessProgress("m01");
  const reflection = useAssessOutput<string[]>("m01.reflection");
  const methodNote = useAssessOutput<string[]>("m01.method_note");
  const tokenAwarenessOut = useAssessOutput<TokenAwareness>("m01.token_awareness");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reflectionSel, setReflectionSel] = useState<string[]>([]);
  const [noteSel, setNoteSel] = useState<string[]>([]);
  const [tokenAwareness, setTokenAwareness] = useState<TokenAwareness>({
    observations: [],
    strategies: [],
    acknowledged: false,
  });
  const [hydratedReflection, setHydratedReflection] = useState(false);
  const [hydratedNote, setHydratedNote] = useState(false);
  const [hydratedToken, setHydratedToken] = useState(false);
  const [hydratedStep, setHydratedStep] = useState(false);

  // Hydrate current step from progress
  useEffect(() => {
    if (hydratedStep || progress.isLoading) return;
    const status = progress.data?.status;
    if (status === "complete") {
      setStep(3);
    } else {
      const cs = progress.data?.current_step;
      if (cs === 2 || cs === 3) setStep(cs as 2 | 3);
    }
    setHydratedStep(true);
  }, [hydratedStep, progress.isLoading, progress.data?.current_step, progress.data?.status]);

  // Mark in_progress on mount
  useEffect(() => {
    if (progress.isLoading) return;
    const status = progress.data?.status;
    if (!status || status === "not_started") {
      progress.setStep.mutate(progress.data?.current_step ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.isLoading]);

  // Seed m01.reflection defaults once if missing
  useEffect(() => {
    if (!user || !workspace) return;
    if (reflection.isLoading) return;
    if (reflection.value !== undefined) return;
    (async () => {
      const seeds = M01_OCR_CONTENT.seeds["m01.reflection"];
      const { error } = await supabase.from("assess_outputs").upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          output_key: "m01.reflection",
          value: seeds as never,
          seeded: true,
          touched: false,
        },
        { onConflict: "workspace_id,user_id,output_key" },
      );
      if (!error) {
        qc.invalidateQueries({
          queryKey: ["assess-output", workspace.id, user.id, "m01.reflection"],
        });
      }
    })();
  }, [user, workspace, reflection.isLoading, reflection.value, qc]);

  // Hydrate local selection state from persisted values
  useEffect(() => {
    if (hydratedReflection || reflection.isLoading) return;
    if (Array.isArray(reflection.value)) {
      setReflectionSel(reflection.value);
      setHydratedReflection(true);
    }
  }, [hydratedReflection, reflection.isLoading, reflection.value]);

  useEffect(() => {
    if (hydratedNote || methodNote.isLoading) return;
    if (Array.isArray(methodNote.value)) {
      setNoteSel(methodNote.value);
    }
    setHydratedNote(true);
  }, [hydratedNote, methodNote.isLoading, methodNote.value]);

  useEffect(() => {
    if (hydratedToken || tokenAwarenessOut.isLoading) return;
    const v = tokenAwarenessOut.value;
    if (v && typeof v === "object") {
      setTokenAwareness({
        observations: Array.isArray(v.observations) ? v.observations : [],
        strategies: Array.isArray(v.strategies) ? v.strategies : [],
        acknowledged: !!v.acknowledged,
      });
    }
    setHydratedToken(true);
  }, [hydratedToken, tokenAwarenessOut.isLoading, tokenAwarenessOut.value]);

  const dangerousTaskOptions = useMemo(
    () =>
      getM01DangerousTaskOptions({
        companyName: workspace?.name,
        accountingSoftware: useCaseProfile.data?.accounting_software as string | undefined,
        country: workspaceProfile.data?.country as string | undefined,
        invoiceVolume: useCaseProfile.data?.invoice_volume as string | undefined,
        vatContext: useCaseProfile.data?.vat_context as string | undefined,
      }),
    [
      workspace?.name,
      workspaceProfile.data,
      useCaseProfile.data,
    ],
  );

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const goToStep = async (next: 1 | 2 | 3) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM01 = async () => {
    if (!user || !workspace) return;
    await methodNote.setValue.mutateAsync(noteSel);
    await tokenAwarenessOut.setValue.mutateAsync(tokenAwareness);
    // Upsert progress as complete with current_step cleared
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m01",
        status: "complete",
        studied: progress.data?.studied ?? false,
        current_step: null,
        max_step_reached: Math.max(progress.data?.max_step_reached ?? 0, 3),
        started_at: progress.data?.started_at ?? new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,user_id,module_id" },
    );
    if (error) {
      toast.error("Could not complete M01. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m01"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M01 complete. M02 Data Readiness is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess",
      params: { workspaceSlug: workspace.slug },
    });
  };

  if (!workspace) return null;

  // ============ STEP 1 ============
  if (step === 1) {
    const s = M01_OCR_CONTENT.step1;
    return (
      <Step
        storyHeader={M01_OCR_CONTENT.storyHeader}
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 1 of 3"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => <li key={w}>{w}</li>)}
          </ul>
        }
        yourVersion={
          <div className="space-y-6">
            <PromptBlock label="Prompt 1 — Without web search" text={s.prompts.withoutSearch} />
            <PromptBlock label="Prompt 2 — With web search" text={s.prompts.withSearch} />
            <p className="text-[12px] italic text-slate">
              Run both prompts in your LLM of choice, then continue.
            </p>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue
        nextLabel={s.nextLabel}
        onContinue={() => goToStep(2)}
      />
    );
  }

  // ============ STEP 2 ============
  if (step === 2) {
    const s = M01_OCR_CONTENT.step2;
    const exps = s.experiments;
    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 2 of 3"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => <li key={w}>{w}</li>)}
          </ul>
        }
        yourVersion={
          <div className="space-y-6">
            <details open className="rounded border border-chalk bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-navy">
                {exps.temperature.label}
              </summary>
              <div className="mt-4 space-y-4">
                <PromptBlock label={exps.temperature.low.label} text={exps.temperature.low.prompt} />
                <PromptBlock label={exps.temperature.high.label} text={exps.temperature.high.prompt} />
              </div>
            </details>
            <details className="rounded border border-chalk bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-navy">
                {exps.topK.label}
              </summary>
              <div className="mt-4 space-y-4">
                <PromptBlock label={exps.topK.low.label} text={exps.topK.low.prompt} />
                <PromptBlock label={exps.topK.high.label} text={exps.topK.high.prompt} />
              </div>
            </details>
            <details className="rounded border border-chalk bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-navy">
                {exps.topP.label}
              </summary>
              <div className="mt-4 space-y-4">
                <PromptBlock label={exps.topP.low.label} text={exps.topP.low.prompt} />
                <PromptBlock label={exps.topP.high.label} text={exps.topP.high.prompt} />
              </div>
            </details>

            <div className="border-t border-chalk pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-navy">
                  Reflection — pick the takeaways that match what you observed
                </p>
                {reflection.seeded && !reflection.touched && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate">
                    Seeded
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {s.reflectionOptions.map((opt) => (
                  <li key={opt}>
                    <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                      <input
                        type="checkbox"
                        checked={reflectionSel.includes(opt)}
                        onChange={() => {
                          const next = toggle(reflectionSel, opt);
                          setReflectionSel(next);
                          reflection.setValue.mutate(next);
                        }}
                        className="mt-1 h-4 w-4 accent-terracotta"
                      />
                      <span>{opt}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] italic text-slate">
                {reflectionSel.length} selected — pick at least one to continue.
              </p>
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={reflectionSel.length > 0}
        disabledReason="Pick at least one reflection."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={() => goToStep(3)}
      />
    );
  }

  // ============ STEP 3 — METHOD NOTE ============
  const m = M01_OCR_CONTENT.methodNote;
  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 3 of 3 · METHOD NOTE"
      title={m.title}
      why={<p>{m.why}</p>}
      yourVersion={
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-medium text-navy">
              Tasks at {workspace.name} where confidently-wrong AI would be dangerous (pick all that apply)
            </p>
            <ul className="space-y-2">
              {dangerousTaskOptions.map((opt) => (
                <li key={opt}>
                  <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                    <input
                      type="checkbox"
                      checked={noteSel.includes(opt)}
                      onChange={() => {
                        const next = toggle(noteSel, opt);
                        setNoteSel(next);
                        methodNote.setValue.mutate(next);
                      }}
                      className="mt-1 h-4 w-4 accent-terracotta"
                    />
                    <span>{opt}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[12px] italic text-slate">
              {noteSel.length} selected — pick at least one to complete M01.
            </p>
          </div>

          <div className="space-y-4 border-t border-chalk pt-6">
            <div>
              <p className="text-sm font-medium text-navy">Token & cost awareness</p>
              <p className="text-[12px] text-slate">
                Try a preset, then mark what you noticed and one cost-control strategy.
              </p>
            </div>
            <div className="card">
              <TokenizerLab compact />
            </div>

            <div className="space-y-2">
              <p className="eyebrow-muted">WHAT I NOTICED (PICK ≥ 3)</p>
              <ul className="space-y-2">
                {TOKEN_OBSERVATIONS.map((opt) => {
                  const isOn = tokenAwareness.observations.includes(opt);
                  return (
                    <li key={opt}>
                      <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => {
                            const next: TokenAwareness = {
                              ...tokenAwareness,
                              observations: toggle(tokenAwareness.observations, opt),
                            };
                            setTokenAwareness(next);
                            tokenAwarenessOut.setValue.mutate(next);
                          }}
                          className="mt-1 h-4 w-4 accent-terracotta"
                        />
                        <span>{opt}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="font-mono text-[11px] text-slate">
                {tokenAwareness.observations.length} selected · target ≥ 3
              </p>
            </div>

            <div className="space-y-2">
              <p className="eyebrow-muted">COST-CONTROL STRATEGY (PICK ≥ 1)</p>
              <ul className="space-y-2">
                {TOKEN_STRATEGIES.map((opt) => {
                  const isOn = tokenAwareness.strategies.includes(opt);
                  return (
                    <li key={opt}>
                      <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => {
                            const next: TokenAwareness = {
                              ...tokenAwareness,
                              strategies: toggle(tokenAwareness.strategies, opt),
                            };
                            setTokenAwareness(next);
                            tokenAwarenessOut.setValue.mutate(next);
                          }}
                          className="mt-1 h-4 w-4 accent-terracotta"
                        />
                        <span>{opt}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="font-mono text-[11px] text-slate">
                {tokenAwareness.strategies.length} selected · target ≥ 1
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
              <input
                type="checkbox"
                checked={tokenAwareness.acknowledged}
                onChange={(e) => {
                  const next: TokenAwareness = {
                    ...tokenAwareness,
                    acknowledged: e.target.checked,
                  };
                  setTokenAwareness(next);
                  tokenAwarenessOut.setValue.mutate(next);
                }}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              I understand AI processes text as tokens and that token volume drives cost.
            </label>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{m.produces}</p>}
      canContinue={
        noteSel.length > 0 &&
        tokenAwareness.observations.length >= 3 &&
        tokenAwareness.strategies.length >= 1 &&
        tokenAwareness.acknowledged
      }
      disabledReason="Pick at least one dangerous task, 3 token observations, 1 strategy, and confirm."
      nextLabel="Complete M01"
      onBack={() => goToStep(2)}
      onContinue={completeM01}
    />
  );
}

export function M01WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m01" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
