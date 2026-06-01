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
import { PrototypeSurfaceMap } from "@/components/assess/PrototypeSurfaceMap";
import { AgentRequirementCards } from "@/components/assess/AgentRequirementCards";
import {
  M05_OCR_CONTENT,
  getM05PrototypeBriefScaffold,
  type PrototypeSurfaceId,
  type PrototypeRequirementId,
} from "@/lib/worked-examples/invoice-ocr/m05";

const CHAPTER_LABEL = "PHASE 02 · M05 · PROTOTYPING WITH NO-CODE";
const TOTAL_STEPS = 3;

type StepNum = 1 | 2 | 3;

const SURFACE_IDS: readonly PrototypeSurfaceId[] = ["upload", "review", "approve", "audit"];
const REQUIREMENT_IDS: readonly PrototypeRequirementId[] = [
  "ocr_extraction",
  "system_sync",
  "hitl_queue",
];

const WALKTHROUGH_FINDINGS = [
  "status unclear",
  "approval moment unclear",
  "missing audit trail",
  "mock data needs better edge cases",
  "handoff unclear",
  "exception path missing",
  "looks ready",
] as const;

const REQUIREMENT_CAPABILITIES: Record<PrototypeRequirementId, readonly string[]> = {
  ocr_extraction: [
    "extract required fields",
    "flag low confidence",
    "separate invoice header and line items",
    "surface missing data",
  ],
  system_sync: [
    "prepare accounting export",
    "block unsafe write",
    "log sync status",
    "show retry path",
  ],
  hitl_queue: [
    "route exceptions",
    "capture approval",
    "store decision reason",
    "make audit trail visible",
  ],
};

type ScopeOutput = Record<PrototypeSurfaceId, boolean>;

interface BriefOutput {
  brief: string;
  acknowledged: boolean;
}

interface RequirementsOutput {
  walkthroughFindings: Record<string, string[]>;
  walkthroughNotes: Record<string, string>;
  capabilities: Record<PrototypeRequirementId, string[]>;
  notes: Record<PrototypeRequirementId, string>;
  acknowledged: boolean;
  // legacy fields kept for backward compat reads
  walkthrough?: Record<string, string>;
  requirements?: Record<PrototypeRequirementId, string>;
}

function buildScopeDefaults(): ScopeOutput {
  return { upload: false, review: false, approve: false, audit: false };
}

function buildRequirementsDefaults(): RequirementsOutput {
  return {
    walkthroughFindings: {},
    walkthroughNotes: {},
    capabilities: { ocr_extraction: [], system_sync: [], hitl_queue: [] },
    notes: { ocr_extraction: "", system_sync: "", hitl_queue: "" },
    acknowledged: false,
  };
}

function isScopeComplete(v: ScopeOutput) {
  return SURFACE_IDS.every((id) => v[id]);
}

function assembleBrief(scaffold: ReturnType<typeof getM05PrototypeBriefScaffold>) {
  return [
    "# 1 · AUDIENCE & DOMAIN",
    scaffold.audience,
    "",
    "# 2 · APP PURPOSE",
    scaffold.appPurpose,
    "",
    "# 3 · SCREENS",
    scaffold.screens,
    "",
    "# 4 · MOCK DATA RULES",
    scaffold.mockDataRules,
    "",
    "# 5 · INTERACTION RULES",
    scaffold.interactionRules,
    "",
    "# 6 · NON-GOALS",
    scaffold.nonGoals,
  ].join("\n");
}

export function M05Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m05");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  // New canonical key per completion.ts
  const surfacesOut = useAssessOutput<ScopeOutput>("m05.surfaces");
  // Legacy key for backward-compatible migration
  const legacyScopeOut = useAssessOutput<ScopeOutput>("m05.prototype_scope");
  const briefOut = useAssessOutput<BriefOutput>("m05.prototype_brief");
  const requirementsOut = useAssessOutput<RequirementsOutput>("m05.agent_requirements");

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

  const scaffold = useMemo(() => getM05PrototypeBriefScaffold(profileContext), [profileContext]);
  const seededBrief = useMemo(() => assembleBrief(scaffold), [scaffold]);

  const [step, setStep] = useState<StepNum>(1);
  const [scope, setScope] = useState<ScopeOutput>(buildScopeDefaults());
  const [brief, setBrief] = useState<BriefOutput>({ brief: "", acknowledged: false });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [requirements, setRequirements] = useState<RequirementsOutput>(
    buildRequirementsDefaults(),
  );

  const [hydrated, setHydrated] = useState({
    step: false,
    scope: false,
    brief: false,
    requirements: false,
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

  // Hydrate scope — prefer m05.surfaces, fall back to legacy m05.prototype_scope
  useEffect(() => {
    if (hydrated.scope || surfacesOut.isLoading || legacyScopeOut.isLoading) return;
    const source =
      surfacesOut.value && typeof surfacesOut.value === "object"
        ? (surfacesOut.value as Partial<ScopeOutput>)
        : legacyScopeOut.value && typeof legacyScopeOut.value === "object"
          ? (legacyScopeOut.value as Partial<ScopeOutput>)
          : null;
    if (source) {
      const merged = buildScopeDefaults();
      for (const id of SURFACE_IDS) merged[id] = !!source[id];
      setScope(merged);
      // Migrate legacy → canonical key once
      if (!surfacesOut.value && legacyScopeOut.value) {
        surfacesOut.setValue.mutate(merged);
      }
    }
    setHydrated((h) => ({ ...h, scope: true }));
  }, [
    hydrated.scope,
    surfacesOut.isLoading,
    surfacesOut.value,
    legacyScopeOut.isLoading,
    legacyScopeOut.value,
  ]);

  // Hydrate brief
  useEffect(() => {
    if (hydrated.brief || briefOut.isLoading) return;
    if (briefOut.value && typeof briefOut.value === "object") {
      const v = briefOut.value as Partial<BriefOutput>;
      setBrief({
        brief: typeof v.brief === "string" && v.brief.length > 0 ? v.brief : seededBrief,
        acknowledged: !!v.acknowledged,
      });
    } else {
      setBrief({ brief: seededBrief, acknowledged: false });
    }
    setHydrated((h) => ({ ...h, brief: true }));
  }, [hydrated.brief, briefOut.isLoading, briefOut.value, seededBrief]);

  // Hydrate requirements (with legacy support)
  useEffect(() => {
    if (hydrated.requirements || requirementsOut.isLoading) return;
    const merged = buildRequirementsDefaults();
    if (requirementsOut.value && typeof requirementsOut.value === "object") {
      const v = requirementsOut.value as Partial<RequirementsOutput>;
      if (v.walkthroughFindings && typeof v.walkthroughFindings === "object") {
        for (const [k, arr] of Object.entries(v.walkthroughFindings)) {
          if (Array.isArray(arr)) merged.walkthroughFindings[k] = arr.filter((x) => typeof x === "string");
        }
      }
      if (v.walkthroughNotes && typeof v.walkthroughNotes === "object") {
        for (const [k, val] of Object.entries(v.walkthroughNotes)) {
          if (typeof val === "string") merged.walkthroughNotes[k] = val;
        }
      }
      // legacy walkthrough notes
      if (v.walkthrough && typeof v.walkthrough === "object") {
        for (const [k, val] of Object.entries(v.walkthrough)) {
          if (typeof val === "string" && !merged.walkthroughNotes[k]) {
            merged.walkthroughNotes[k] = val;
          }
        }
      }
      if (v.capabilities && typeof v.capabilities === "object") {
        for (const id of REQUIREMENT_IDS) {
          const arr = (v.capabilities as Record<string, unknown>)[id];
          if (Array.isArray(arr)) merged.capabilities[id] = arr.filter((x) => typeof x === "string");
        }
      }
      if (v.notes && typeof v.notes === "object") {
        for (const id of REQUIREMENT_IDS) {
          const val = (v.notes as Record<string, unknown>)[id];
          if (typeof val === "string") merged.notes[id] = val;
        }
      }
      // legacy requirements notes
      if (v.requirements && typeof v.requirements === "object") {
        for (const id of REQUIREMENT_IDS) {
          const val = (v.requirements as Record<string, unknown>)[id];
          if (typeof val === "string" && !merged.notes[id]) merged.notes[id] = val;
        }
      }
      merged.acknowledged = !!v.acknowledged;
    }
    setRequirements(merged);
    setHydrated((h) => ({ ...h, requirements: true }));
  }, [hydrated.requirements, requirementsOut.isLoading, requirementsOut.value]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM05 = async () => {
    if (!user || !workspace) return;
    await requirementsOut.setValue.mutateAsync(requirements);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m05",
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
      toast.error("Could not complete M05. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m05"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M05 complete. M06 AI Agents & Pilot is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess",
      params: { workspaceSlug: workspace.slug },
    });
  };

  if (!workspace) return null;

  // ============ STEP 1 — Surfaces ============
  if (step === 1) {
    const s = M05_OCR_CONTENT.step1;
    const allAcked = isScopeComplete(scope);
    return (
      <Step
        storyHeader={M05_OCR_CONTENT.storyHeader}
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 1 of 3"
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
            <PrototypeSurfaceMap surfaces={M05_OCR_CONTENT.surfaces} />
            <ul className="space-y-2">
              {M05_OCR_CONTENT.surfaces.map((s2) => (
                <li key={s2.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
                    <input
                      type="checkbox"
                      checked={scope[s2.id]}
                      onChange={(e) => {
                        const next = { ...scope, [s2.id]: e.target.checked };
                        setScope(next);
                        surfacesOut.setValue.mutate(next);
                      }}
                      className="mt-1 h-4 w-4 accent-terracotta"
                    />
                    <span>
                      <span className="font-medium">{s2.title}</span> is in scope for the prototype.
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={allAcked}
        disabledReason="Acknowledge all four surfaces."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await surfacesOut.setValue.mutateAsync(scope);
          await goToStep(2);
        }}
      />
    );
  }

  // ============ STEP 2 — Generated brief, review & accept ============
  if (step === 2) {
    const s = M05_OCR_CONTENT.step2;
    const briefReady = brief.brief.trim().length > 0 && brief.acknowledged;
    return (
      <Step
        chapterLabel={CHAPTER_LABEL}
        stepLabel="STEP 2 of 3"
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
            <p className="eyebrow-muted">PROTOTYPE BRIEF — GENERATED FROM YOUR PROFILE + SELECTED SURFACES</p>
            <div className="rounded-md border border-chalk bg-paper p-3 max-h-[420px] overflow-auto">
              <pre className="font-mono text-[12px] leading-relaxed text-navy whitespace-pre-wrap">{brief.brief}</pre>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(brief.brief);
                  toast.success("Brief copied to clipboard.");
                }}
                className="text-[12px] font-mono uppercase tracking-[0.16em] text-terracotta hover:underline"
              >
                Copy brief
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { ...brief, brief: seededBrief };
                  setBrief(next);
                  briefOut.setValue.mutate(next);
                  toast.success("Brief regenerated from your profile.");
                }}
                className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate hover:text-navy"
              >
                Regenerate
              </button>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
              <input
                type="checkbox"
                checked={brief.acknowledged}
                onChange={(e) => {
                  const next = { ...brief, acknowledged: e.target.checked };
                  setBrief(next);
                  briefOut.setValue.mutate(next);
                }}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              I reviewed this prototype brief.
            </label>

            <details className="rounded-md border border-chalk bg-white" open={showAdvanced}>
              <summary
                onClick={() => setShowAdvanced((v) => !v)}
                className="cursor-pointer px-3 py-2 text-[12px] font-mono uppercase tracking-[0.16em] text-slate"
              >
                Edit generated brief (optional)
              </summary>
              <div className="p-3">
                <textarea
                  value={brief.brief}
                  onChange={(e) => {
                    const next = { ...brief, brief: e.target.value };
                    setBrief(next);
                    briefOut.setValue.mutate(next);
                  }}
                  rows={18}
                  className="w-full rounded-md border border-chalk bg-paper p-3 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
                />
              </div>
            </details>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={briefReady}
        disabledReason="Review the generated brief and confirm."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await briefOut.setValue.mutateAsync(brief);
          await goToStep(3);
        }}
      />
    );
  }

  // ============ STEP 3 — Walkthrough chips + requirement capabilities ============
  const s = M05_OCR_CONTENT.step3;
  const totalFindings = Object.values(requirements.walkthroughFindings).reduce(
    (n, arr) => n + (arr?.length ?? 0),
    0,
  );
  const eachReqHasMin2 = REQUIREMENT_IDS.every(
    (id) => (requirements.capabilities[id]?.length ?? 0) >= 2,
  );
  const canComplete = totalFindings >= 3 && eachReqHasMin2 && requirements.acknowledged;

  const toggleFinding = (promptId: string, finding: string) => {
    const cur = requirements.walkthroughFindings[promptId] ?? [];
    const next = cur.includes(finding) ? cur.filter((f) => f !== finding) : [...cur, finding];
    const out: RequirementsOutput = {
      ...requirements,
      walkthroughFindings: { ...requirements.walkthroughFindings, [promptId]: next },
    };
    setRequirements(out);
    requirementsOut.setValue.mutate(out);
  };

  const toggleCapability = (id: PrototypeRequirementId, cap: string) => {
    const cur = requirements.capabilities[id] ?? [];
    const next = cur.includes(cap) ? cur.filter((c) => c !== cap) : [...cur, cap];
    const out: RequirementsOutput = {
      ...requirements,
      capabilities: { ...requirements.capabilities, [id]: next },
    };
    setRequirements(out);
    requirementsOut.setValue.mutate(out);
  };

  return (
    <Step
      chapterLabel={CHAPTER_LABEL}
      stepLabel="STEP 3 of 3"
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
          <div className="space-y-3">
            <p className="text-sm font-medium text-navy">
              Walkthrough — select findings (at least 3 total across prompts).
            </p>
            {M05_OCR_CONTENT.walkthroughPrompts.map((p) => {
              const selected = requirements.walkthroughFindings[p.id] ?? [];
              return (
                <div key={p.id} className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2">
                  <p className="text-[13px] text-navy">{p.question}</p>
                  <p className="text-[12px] italic text-slate">{p.captures}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WALKTHROUGH_FINDINGS.map((f) => {
                      const isOn = selected.includes(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => toggleFinding(p.id, f)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.1em] transition ${
                            isOn
                              ? "border-terracotta bg-terracotta/10 text-terracotta"
                              : "border-chalk bg-paper text-slate hover:border-slate"
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                  <details className="text-[12px]">
                    <summary className="cursor-pointer font-mono uppercase tracking-[0.1em] text-slate">
                      Optional note
                    </summary>
                    <textarea
                      value={requirements.walkthroughNotes[p.id] ?? ""}
                      onChange={(e) => {
                        const next: RequirementsOutput = {
                          ...requirements,
                          walkthroughNotes: {
                            ...requirements.walkthroughNotes,
                            [p.id]: e.target.value,
                          },
                        };
                        setRequirements(next);
                        requirementsOut.setValue.mutate(next);
                      }}
                      rows={2}
                      placeholder="Optional context"
                      className="mt-1 w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                    />
                  </details>
                </div>
              );
            })}
            <p className="font-mono text-[11px] text-slate">
              {totalFindings} findings selected · target ≥ 3
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-navy">
              Agent requirement cards — pick ≥ 2 capabilities per card.
            </p>
            <AgentRequirementCards cards={M05_OCR_CONTENT.defaultRequirementCards} />
            {M05_OCR_CONTENT.defaultRequirementCards.map((c) => {
              const selected = requirements.capabilities[c.id] ?? [];
              return (
                <div key={c.id} className="rounded-md border border-chalk bg-white px-4 py-3 space-y-2">
                  <p className="eyebrow-muted">{c.title.toUpperCase()}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REQUIREMENT_CAPABILITIES[c.id].map((cap) => {
                      const isOn = selected.includes(cap);
                      return (
                        <label
                          key={cap}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-[12px] transition ${
                            isOn
                              ? "border-terracotta bg-terracotta/10 text-navy"
                              : "border-chalk bg-paper text-slate hover:border-slate"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggleCapability(c.id, cap)}
                            className="h-3.5 w-3.5 accent-terracotta"
                          />
                          {cap}
                        </label>
                      );
                    })}
                  </div>
                  <p className="font-mono text-[11px] text-slate">
                    {selected.length} selected · target ≥ 2
                  </p>
                  <details className="text-[12px]">
                    <summary className="cursor-pointer font-mono uppercase tracking-[0.1em] text-slate">
                      Optional note
                    </summary>
                    <textarea
                      value={requirements.notes[c.id] ?? ""}
                      onChange={(e) => {
                        const next: RequirementsOutput = {
                          ...requirements,
                          notes: { ...requirements.notes, [c.id]: e.target.value },
                        };
                        setRequirements(next);
                        requirementsOut.setValue.mutate(next);
                      }}
                      rows={2}
                      placeholder="Optional context"
                      className="mt-1 w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                    />
                  </details>
                </div>
              );
            })}
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-[14px] text-navy">
            <input
              type="checkbox"
              checked={requirements.acknowledged}
              onChange={(e) => {
                const next = { ...requirements, acknowledged: e.target.checked };
                setRequirements(next);
                requirementsOut.setValue.mutate(next);
              }}
              className="mt-1 h-4 w-4 accent-terracotta"
            />
            These three requirement cards are the brief I will hand to M06.
          </label>

          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M05_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canComplete}
      disabledReason="Select ≥ 3 walkthrough findings, ≥ 2 capabilities per requirement card, and confirm."
      nextLabel="Complete M05 → unlock M06"
      onBack={() => goToStep(2)}
      onContinue={completeM05}
    />
  );
}

export function M05WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess"
      params={{ workspaceSlug: slug }}
      className="text-[12px] font-mono uppercase tracking-[0.18em] text-slate hover:text-navy"
    >
      ← Back to Assess
    </Link>
  );
}
