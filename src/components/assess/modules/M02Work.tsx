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
import { OCRBlockWalkthrough } from "@/components/assess/OCRBlockWalkthrough";
import { SeededBadge } from "@/components/assess/SeededBadge";
import {
  M02_OCR_CONTENT,
  getM02InternalSourceOptions,
  getM02ContextualRuleOptions,
} from "@/lib/worked-examples/invoice-ocr/m02";

const CHAPTER_LABEL = "PHASE 01 · M02 · DATA READINESS";
const TOTAL_STEPS = 4;

type StepNum = 1 | 2 | 3 | 4;

interface TestSetShape {
  clean: number;
  edge: number;
  adversarial: number;
}

const DEFAULT_TEST_SET: TestSetShape = { clean: 5, edge: 5, adversarial: 5 };

export function M02Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m02");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const internalSourcesOut = useAssessOutput<string[]>("m02.internal_sources");
  const contextualRulesOut = useAssessOutput<string[]>("m02.contextual_rules");
  const testSetOut = useAssessOutput<TestSetShape>("m02.test_set");
  const gapsOut = useAssessOutput<string[]>("m02.gaps");

  const [step, setStep] = useState<StepNum>(1);
  const [internalSel, setInternalSel] = useState<string[]>([]);
  const [contextualSel, setContextualSel] = useState<string[]>([]);
  const [testSet, setTestSet] = useState<TestSetShape>(DEFAULT_TEST_SET);
  const [gapsSel, setGapsSel] = useState<string[]>([]);

  const [hydrated, setHydrated] = useState({
    step: false,
    internal: false,
    contextual: false,
    testSet: false,
    gaps: false,
  });

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

  const internalSourceOptions = useMemo(
    () => getM02InternalSourceOptions(profileContext),
    [profileContext],
  );
  const contextualRuleOptions = useMemo(
    () => getM02ContextualRuleOptions(profileContext),
    [profileContext],
  );

  // Hydrate step from progress
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

  // Mark in_progress on mount if not started
  useEffect(() => {
    if (progress.isLoading) return;
    const status = progress.data?.status;
    if (!status || status === "not_started") {
      progress.setStep.mutate(progress.data?.current_step ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.isLoading]);

  // Seed m02.test_set defaults once if missing
  useEffect(() => {
    if (!user || !workspace) return;
    if (testSetOut.isLoading) return;
    if (testSetOut.value !== undefined) return;
    (async () => {
      const seeds = M02_OCR_CONTENT.seeds["m02.test_set"];
      const { error } = await supabase.from("assess_outputs").upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          output_key: "m02.test_set",
          value: seeds as never,
          seeded: true,
          touched: false,
        },
        { onConflict: "workspace_id,user_id,output_key" },
      );
      if (!error) {
        qc.invalidateQueries({
          queryKey: ["assess-output", workspace.id, user.id, "m02.test_set"],
        });
      }
    })();
  }, [user, workspace, testSetOut.isLoading, testSetOut.value, qc]);

  // Hydrate local state from persisted outputs
  useEffect(() => {
    if (hydrated.internal || internalSourcesOut.isLoading) return;
    if (Array.isArray(internalSourcesOut.value)) setInternalSel(internalSourcesOut.value);
    setHydrated((h) => ({ ...h, internal: true }));
  }, [hydrated.internal, internalSourcesOut.isLoading, internalSourcesOut.value]);

  useEffect(() => {
    if (hydrated.contextual || contextualRulesOut.isLoading) return;
    if (Array.isArray(contextualRulesOut.value)) setContextualSel(contextualRulesOut.value);
    setHydrated((h) => ({ ...h, contextual: true }));
  }, [hydrated.contextual, contextualRulesOut.isLoading, contextualRulesOut.value]);

  useEffect(() => {
    if (hydrated.testSet || testSetOut.isLoading) return;
    if (testSetOut.value && typeof testSetOut.value === "object") {
      setTestSet({ ...DEFAULT_TEST_SET, ...(testSetOut.value as Partial<TestSetShape>) });
    }
    setHydrated((h) => ({ ...h, testSet: true }));
  }, [hydrated.testSet, testSetOut.isLoading, testSetOut.value]);

  useEffect(() => {
    if (hydrated.gaps || gapsOut.isLoading) return;
    if (Array.isArray(gapsOut.value)) setGapsSel(gapsOut.value);
    setHydrated((h) => ({ ...h, gaps: true }));
  }, [hydrated.gaps, gapsOut.isLoading, gapsOut.value]);

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const testSetTotal = testSet.clean + testSet.edge + testSet.adversarial;

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM02 = async () => {
    if (!user || !workspace) return;
    await gapsOut.setValue.mutateAsync(gapsSel);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m02",
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
      toast.error("Could not complete M02. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m02"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M02 complete. M03 Prompt Engineering is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess",
      params: { workspaceSlug: workspace.slug },
    });
  };

  if (!workspace) return null;

  // ============ STEP 1 — Internal data ============
  if (step === 1) {
    const s = M02_OCR_CONTENT.step1;
    return (
      <Step
        storyHeader={M02_OCR_CONTENT.storyHeader}
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 1 of 4"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => <li key={w}>{w}</li>)}
          </ul>
        }
        yourVersion={
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="eyebrow">THE OCR INTERNAL-DATA MAP</p>
              <OCRBlockWalkthrough block={M02_OCR_CONTENT.internalSources} />
            </div>

            <div className="border-t border-chalk pt-6 space-y-3">
              <p className="text-sm font-medium text-navy">
                Which internal data sources exist in {workspace.name}? (pick all that apply)
              </p>
              <ul className="space-y-2">
                {internalSourceOptions.map((opt) => (
                  <li key={opt}>
                    <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                      <input
                        type="checkbox"
                        checked={internalSel.includes(opt)}
                        onChange={() => {
                          const next = toggle(internalSel, opt);
                          setInternalSel(next);
                          internalSourcesOut.setValue.mutate(next);
                        }}
                        className="mt-1 h-4 w-4 accent-terracotta"
                      />
                      <span>{opt}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] italic text-slate">
                {internalSel.length} selected — pick at least one to continue.
              </p>
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={internalSel.length > 0}
        disabledReason="Pick at least one internal source."
        nextLabel={s.nextLabel}
        onContinue={() => goToStep(2)}
      />
    );
  }

  // ============ STEP 2 — Contextual rules ============
  if (step === 2) {
    const s = M02_OCR_CONTENT.step2;
    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 2 of 4"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => <li key={w}>{w}</li>)}
          </ul>
        }
        yourVersion={
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="eyebrow">THE OCR CONTEXTUAL-RULES MAP</p>
              <OCRBlockWalkthrough block={M02_OCR_CONTENT.contextualRules} />
            </div>

            <div className="border-t border-chalk pt-6 space-y-3">
              <p className="text-sm font-medium text-navy">
                Which contextual rules apply at {workspace.name}? (pick all that apply)
              </p>
              <ul className="space-y-2">
                {contextualRuleOptions.map((opt) => (
                  <li key={opt}>
                    <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                      <input
                        type="checkbox"
                        checked={contextualSel.includes(opt)}
                        onChange={() => {
                          const next = toggle(contextualSel, opt);
                          setContextualSel(next);
                          contextualRulesOut.setValue.mutate(next);
                        }}
                        className="mt-1 h-4 w-4 accent-terracotta"
                      />
                      <span>{opt}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] italic text-slate">
                {contextualSel.length} selected — pick at least one to continue.
              </p>
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={contextualSel.length > 0}
        disabledReason="Pick at least one contextual rule."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={() => goToStep(3)}
      />
    );
  }

  // ============ STEP 3 — Task-specific test set ============
  if (step === 3) {
    const s = M02_OCR_CONTENT.step3;

    const updateTestSet = (key: keyof TestSetShape, value: number) => {
      const next = { ...testSet, [key]: Math.max(0, value) };
      setTestSet(next);
      testSetOut.setValue.mutate(next);
    };

    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 3 of 4"
        title={s.title}
        why={<p>{s.why}</p>}
        example={<p className="text-[14px] text-navy">{s.example}</p>}
        whatToNotice={
          <ul className="list-disc pl-5 text-[14px] text-navy">
            {s.whatToNotice.map((w) => <li key={w}>{w}</li>)}
          </ul>
        }
        yourVersion={
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="eyebrow">THE OCR TEST SET</p>
              <OCRBlockWalkthrough block={M02_OCR_CONTENT.testSet} />
            </div>

            <div className="border-t border-chalk pt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-navy">
                  Your test set composition for {workspace.name}
                </p>
                <SeededBadge seeded={testSetOut.seeded} touched={testSetOut.touched} />
              </div>
              <p className="text-[12px] italic text-slate">
                Adjust the counts to match what your team can realistically curate. Minimum total: 3.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TestSetField
                  label="Clean cases"
                  hint="Textbook layouts, baseline accuracy"
                  value={testSet.clean}
                  onChange={(v) => updateTestSet("clean", v)}
                />
                <TestSetField
                  label="Edge cases"
                  hint="Known failure modes from production"
                  value={testSet.edge}
                  onChange={(v) => updateTestSet("edge", v)}
                />
                <TestSetField
                  label="Adversarial cases"
                  hint="Tests of refusal, not accuracy"
                  value={testSet.adversarial}
                  onChange={(v) => updateTestSet("adversarial", v)}
                />
              </div>

              <p className="text-[12px] italic text-slate">
                {testSetTotal} invoices total
                {testSetTotal < 3 ? " — need at least 3 to continue." : " — minimum reached."}
              </p>
            </div>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={testSetTotal >= 3}
        disabledReason="Total must be at least 3."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(2)}
        onContinue={() => goToStep(4)}
      />
    );
  }

  // ============ STEP 4 — Three-layer map + gaps + complete ============
  const s = M02_OCR_CONTENT.step4;
  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 4 of 4 · METHOD NOTE"
      title={s.title}
      why={<p>{s.why}</p>}
      example={<p className="text-[14px] text-navy">{s.example}</p>}
      whatToNotice={
        <ul className="list-disc pl-5 text-[14px] text-navy">
          {s.whatToNotice.map((w) => <li key={w}>{w}</li>)}
        </ul>
      }
      yourVersion={
        <div className="space-y-8">
          {/* Three-layer synthesis card */}
          <div className="card border-l-[3px] border-l-terracotta space-y-5">
            <p className="eyebrow">YOUR THREE-LAYER DATA MAP — {workspace.name.toUpperCase()}</p>

            <LayerRow
              num="01"
              label="Internal data"
              items={internalSel}
              empty="No internal sources selected yet — go back to Step 1."
            />
            <LayerRow
              num="02"
              label="Contextual data"
              items={contextualSel}
              empty="No contextual rules selected yet — go back to Step 2."
            />

            <div className="space-y-1">
              <span className="inline-flex items-center rounded-full border border-chalk bg-mist/60 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate">
                LAYER 03
              </span>
              <p className="text-sm font-medium text-navy mt-1">Task-specific data</p>
              <p className="text-[13px] text-graphite">
                {testSet.clean} clean · {testSet.edge} edge · {testSet.adversarial} adversarial = {testSetTotal} invoices total
              </p>
            </div>
          </div>

          {/* Gaps multi-select */}
          <div className="border-t border-chalk pt-6 space-y-3">
            <p className="text-sm font-medium text-navy">
              Which gaps do you recognise in your own world? (pick all that apply)
            </p>
            <p className="text-[12px] italic text-slate">
              At least one. M02 is done when the gaps are named, not when the layers are listed.
            </p>
            <ul className="space-y-2">
              {M02_OCR_CONTENT.gapOptions.map((opt) => (
                <li key={opt}>
                  <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                    <input
                      type="checkbox"
                      checked={gapsSel.includes(opt)}
                      onChange={() => {
                        const next = toggle(gapsSel, opt);
                        setGapsSel(next);
                        gapsOut.setValue.mutate(next);
                      }}
                      className="mt-1 h-4 w-4 accent-terracotta"
                    />
                    <span>{opt}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[12px] italic text-slate">
              {gapsSel.length} selected — pick at least one to complete M02.
            </p>
          </div>

          {/* Method-note callout */}
          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M02_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={gapsSel.length > 0}
      disabledReason="Pick at least one gap."
      nextLabel="Complete M02"
      onBack={() => goToStep(3)}
      onContinue={completeM02}
    />
  );
}

function TestSetField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-md border border-chalk bg-white p-3">
      <p className="text-sm font-medium text-navy">{label}</p>
      <p className="text-[12px] text-slate">{hint}</p>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="mt-2 w-full rounded border border-chalk bg-paper px-2 py-1.5 text-[14px] text-navy outline-none focus:border-terracotta"
      />
    </div>
  );
}

function LayerRow({
  num,
  label,
  items,
  empty,
}: {
  num: string;
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center rounded-full border border-chalk bg-mist/60 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate">
        LAYER {num}
      </span>
      <p className="text-sm font-medium text-navy mt-1">{label}</p>
      {items.length === 0 ? (
        <p className="text-[13px] italic text-slate">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it} className="text-[13px] text-graphite">
              · {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function M02WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m02" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
