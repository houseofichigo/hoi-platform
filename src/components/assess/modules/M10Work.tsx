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
import { DocumentationLayerMap } from "@/components/assess/DocumentationLayerMap";
import { SystemCardEditor } from "@/components/assess/SystemCardEditor";
import { PlaybookRoutineList } from "@/components/assess/PlaybookRoutineList";
import {
  HandoffStagePlan,
  type HandoffStageNote,
} from "@/components/assess/HandoffStagePlan";
import {
  M10_OCR_CONTENT,
  getM10DocumentationScaffold,
  type DocumentationLayerId,
  type HandoffStageId,
} from "@/lib/worked-examples/invoice-ocr/m10";

const CHAPTER_LABEL = "PHASE 04 · M10 · DOCUMENTATION & ADOPTION";
const TOTAL_STEPS = 3;
type StepNum = 1 | 2 | 3;

const LAYER_IDS: readonly DocumentationLayerId[] = [
  "architecture",
  "decisions",
  "governance",
];
const STAGE_IDS: readonly HandoffStageId[] = [
  "review",
  "shadow",
  "joint",
  "backup",
  "ownership",
];

interface OutlineOutput {
  acknowledged: Record<DocumentationLayerId, boolean>;
  outline: string;
}
interface PlaybookOutput {
  systemCard: string;
  operatingPlaybook: string;
  systemCardAck: Record<string, boolean>;
  playbookAck: Record<string, boolean>;
}
interface HandoffOutput {
  notes: Record<HandoffStageId, HandoffStageNote>;
  acknowledged: boolean;
}

function emptyOutline(initialOutline: string): OutlineOutput {
  return {
    acknowledged: { architecture: false, decisions: false, governance: false },
    outline: initialOutline,
  };
}
function emptyHandoff(): HandoffOutput {
  return {
    notes: STAGE_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: { owner: "", backup: "", targetDate: "" } }),
      {} as Record<HandoffStageId, HandoffStageNote>,
    ),
    acknowledged: false,
  };
}

export function M10Work() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const progress = useAssessProgress("m10");
  const workspaceProfile = useWorkspaceProfile();
  const useCaseProfile = useUseCaseProfile();

  const outlineOut = useAssessOutput<OutlineOutput>("m10.documentation_outline");
  const playbookOut = useAssessOutput<PlaybookOutput>("m10.playbook");
  const handoffOut = useAssessOutput<HandoffOutput>("m10.handoff_plan");

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
    () => getM10DocumentationScaffold(profileContext),
    [profileContext],
  );

  const [step, setStep] = useState<StepNum>(1);
  const [outline, setOutline] = useState<OutlineOutput>(() =>
    emptyOutline(scaffold.outline),
  );
  const [playbook, setPlaybook] = useState<PlaybookOutput>({
    systemCard: scaffold.systemCard,
    operatingPlaybook: scaffold.operatingPlaybook,
    systemCardAck: {},
    playbookAck: {},
  });
  const [handoff, setHandoff] = useState<HandoffOutput>(emptyHandoff);

  const [hydrated, setHydrated] = useState({
    step: false,
    outline: false,
    playbook: false,
    handoff: false,
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

  // Hydrate outline
  useEffect(() => {
    if (hydrated.outline || outlineOut.isLoading) return;
    if (outlineOut.value && typeof outlineOut.value === "object") {
      const v = outlineOut.value as Partial<OutlineOutput>;
      const merged = emptyOutline(scaffold.outline);
      if (v.acknowledged && typeof v.acknowledged === "object") {
        for (const id of LAYER_IDS) {
          if (v.acknowledged[id] === true) merged.acknowledged[id] = true;
        }
      }
      if (typeof v.outline === "string" && v.outline.length > 0) {
        merged.outline = v.outline;
      }
      setOutline(merged);
    }
    setHydrated((h) => ({ ...h, outline: true }));
  }, [hydrated.outline, outlineOut.isLoading, outlineOut.value, scaffold.outline]);

  // Hydrate playbook
  useEffect(() => {
    if (hydrated.playbook || playbookOut.isLoading) return;
    if (playbookOut.value && typeof playbookOut.value === "object") {
      const v = playbookOut.value as Partial<PlaybookOutput>;
      setPlaybook({
        systemCard:
          typeof v.systemCard === "string" && v.systemCard.length > 0
            ? v.systemCard
            : scaffold.systemCard,
        operatingPlaybook:
          typeof v.operatingPlaybook === "string" && v.operatingPlaybook.length > 0
            ? v.operatingPlaybook
            : scaffold.operatingPlaybook,
        systemCardAck:
          v.systemCardAck && typeof v.systemCardAck === "object"
            ? (v.systemCardAck as Record<string, boolean>)
            : {},
        playbookAck:
          v.playbookAck && typeof v.playbookAck === "object"
            ? (v.playbookAck as Record<string, boolean>)
            : {},
      });
    } else {
      setPlaybook({
        systemCard: scaffold.systemCard,
        operatingPlaybook: scaffold.operatingPlaybook,
        systemCardAck: {},
        playbookAck: {},
      });
    }
    setHydrated((h) => ({ ...h, playbook: true }));
  }, [hydrated.playbook, playbookOut.isLoading, playbookOut.value, scaffold.systemCard, scaffold.operatingPlaybook]);

  // Hydrate handoff
  useEffect(() => {
    if (hydrated.handoff || handoffOut.isLoading) return;
    if (handoffOut.value && typeof handoffOut.value === "object") {
      const v = handoffOut.value as Partial<HandoffOutput>;
      const merged = emptyHandoff();
      if (v.notes && typeof v.notes === "object") {
        for (const id of STAGE_IDS) {
          const n = (v.notes as Record<string, Partial<HandoffStageNote>>)[id];
          if (n && typeof n === "object") {
            merged.notes[id] = {
              owner: typeof n.owner === "string" ? n.owner : "",
              backup: typeof n.backup === "string" ? n.backup : "",
              targetDate: typeof n.targetDate === "string" ? n.targetDate : "",
            };
          }
        }
      }
      if (v.acknowledged === true) merged.acknowledged = true;
      setHandoff(merged);
    }
    setHydrated((h) => ({ ...h, handoff: true }));
  }, [hydrated.handoff, handoffOut.isLoading, handoffOut.value]);

  const goToStep = async (next: StepNum) => {
    setStep(next);
    await progress.setStep.mutateAsync(next);
  };

  const completeM10 = async () => {
    if (!user || !workspace) return;
    await handoffOut.setValue.mutateAsync(handoff);
    const { error } = await supabase.from("assess_progress").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        module_id: "m10",
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
      toast.error("Could not complete M10. Try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace.id, user.id, "m10"] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace.id, user.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace.id] });
    toast.success("M10 complete. M11 Monitoring & Quality is unlocked.");
    navigate({
      to: "/app/$workspaceSlug/assess/$moduleId",
      params: { workspaceSlug: workspace.slug, moduleId: "m11" },
    });
  };

  if (!workspace) return null;

  // ===== STEP 1 — documentation outline =====
  if (step === 1) {
    const s = M10_OCR_CONTENT.step1;
    const allAcked = LAYER_IDS.every((id) => outline.acknowledged[id] === true);
    const canContinue = allAcked;

    return (
      <Step
        storyHeader={M10_OCR_CONTENT.storyHeader}
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
            <DocumentationLayerMap
              layers={M10_OCR_CONTENT.documentationLayers}
              acknowledged={outline.acknowledged}
              onToggle={(id) => {
                const next: OutlineOutput = {
                  ...outline,
                  acknowledged: {
                    ...outline.acknowledged,
                    [id as DocumentationLayerId]:
                      !outline.acknowledged[id as DocumentationLayerId],
                  },
                };
                setOutline(next);
                outlineOut.setValue.mutate(next);
              }}
            />
            <details className="group rounded-md border border-chalk bg-paper">
              <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
                Advanced — edit the documentation outline (optional)
              </summary>
              <div className="space-y-1 p-3 pt-0">
                <textarea
                  value={outline.outline}
                  onChange={(e) => {
                    const next = { ...outline, outline: e.target.value };
                    setOutline(next);
                    outlineOut.setValue.mutate(next);
                  }}
                  rows={12}
                  placeholder="Optional notes — the generated outline is built from your selected layers."
                  className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
                />
                <p className="text-[12px] text-slate">Optional. Your edits are saved automatically.</p>
              </div>
            </details>
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Acknowledge all three documentation layers."
        nextLabel={s.nextLabel}
        onContinue={async () => {
          await outlineOut.setValue.mutateAsync(outline);
          await goToStep(2);
        }}
      />
    );
  }

  // ===== STEP 2 — system card + playbook =====
  if (step === 2) {
    const s = M10_OCR_CONTENT.step2;
    const allCardAck = M10_OCR_CONTENT.systemCardSections.every(
      (sec) => playbook.systemCardAck[sec.id],
    );
    const allPlaybookAck = M10_OCR_CONTENT.playbookRoutines.every(
      (r) => playbook.playbookAck[r.id],
    );
    const canContinue = allCardAck && allPlaybookAck;

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
          <div className="space-y-8">
            <SystemCardEditor
              sections={M10_OCR_CONTENT.systemCardSections}
              value={playbook.systemCard}
              onChange={(v) => {
                const next = { ...playbook, systemCard: v };
                setPlaybook(next);
                playbookOut.setValue.mutate(next);
              }}
              acknowledged={playbook.systemCardAck}
              onAck={(id, checked) => {
                const next = {
                  ...playbook,
                  systemCardAck: { ...playbook.systemCardAck, [id]: checked },
                };
                setPlaybook(next);
                playbookOut.setValue.mutate(next);
              }}
            />
            <PlaybookRoutineList
              routines={M10_OCR_CONTENT.playbookRoutines}
              value={playbook.operatingPlaybook}
              onChange={(v) => {
                const next = { ...playbook, operatingPlaybook: v };
                setPlaybook(next);
                playbookOut.setValue.mutate(next);
              }}
              acknowledged={playbook.playbookAck}
              onAck={(id, checked) => {
                const next = {
                  ...playbook,
                  playbookAck: { ...playbook.playbookAck, [id]: checked },
                };
                setPlaybook(next);
                playbookOut.setValue.mutate(next);
              }}
            />
          </div>
        }
        produces={<p className="text-[14px] text-navy">{s.produces}</p>}
        canContinue={canContinue}
        disabledReason="Acknowledge every system card section and every playbook routine."
        nextLabel={s.nextLabel}
        onBack={() => goToStep(1)}
        onContinue={async () => {
          await playbookOut.setValue.mutateAsync(playbook);
          await goToStep(3);
        }}
      />
    );
  }

  // ===== STEP 3 — five-stage handoff =====
  const s = M10_OCR_CONTENT.step3;
  const allStagesNoted = STAGE_IDS.every((id) => {
    const n = handoff.notes[id];
    return (
      n &&
      n.owner.trim() !== "" &&
      n.backup.trim() !== "" &&
      n.targetDate.trim() !== ""
    );
  });
  const canContinue = allStagesNoted && handoff.acknowledged;

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
          <HandoffStagePlan
            stages={M10_OCR_CONTENT.handoffStages}
            notes={handoff.notes}
            onChange={(id, note) => {
              const next: HandoffOutput = {
                ...handoff,
                notes: { ...handoff.notes, [id]: note },
              };
              setHandoff(next);
              handoffOut.setValue.mutate(next);
            }}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] text-navy">
            <input
              type="checkbox"
              checked={handoff.acknowledged}
              onChange={(e) => {
                const next = { ...handoff, acknowledged: e.target.checked };
                setHandoff(next);
                handoffOut.setValue.mutate(next);
              }}
              className="h-4 w-4 accent-terracotta"
            />
            I confirm a named owner and a named backup exist for every stage.
          </label>
          <div className="card bg-mist/40 space-y-1">
            <p className="eyebrow-muted">METHOD NOTE</p>
            <p className="text-[14px] text-navy">{M10_OCR_CONTENT.methodNote}</p>
          </div>
        </div>
      }
      produces={<p className="text-[14px] text-navy">{s.produces}</p>}
      canContinue={canContinue}
      disabledReason="Fill owner, backup, and target date for every stage, then acknowledge."
      nextLabel="Complete M10 → M11"
      onBack={() => goToStep(2)}
      onContinue={completeM10}
    />
  );
}

export function M10WorkBackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: "m10" }}
      className="inline-block text-[13px] font-medium text-slate hover:text-navy"
    >
      ← Back to overview
    </Link>
  );
}
