import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deriveGovernanceFlags,
  type DerivedGovernanceFlag,
} from "./governanceFlags";
import {
  notifyRoadmapStageChanged,
  notifyTransitionBlocked,
  notifyGovernanceFlagsCreated,
  notifyFlagAssigned,
  notifyFlagResolved,
  notifyPostPilotReview,
  isResolutionStatus,
} from "./notify.server";
import { ROADMAP_STAGES, type RoadmapStage } from "./types";

// =====================================================================
// Shared persistence helper — used by post-approval generation and by
// stage-transition driven flag creation. Idempotent + audited + notifies.
// =====================================================================

interface PersistCtx {
  workspaceId: string;
  workspaceSlug: string;
  useCaseId: string;
  useCaseName: string;
  actorId: string;
  roadmapEntryId: string | null;
  source: string; // audit metadata
}

async function persistDerivedFlags(
  derived: DerivedGovernanceFlag[],
  ctx: PersistCtx,
): Promise<{ created: number; flags: string[] }> {
  if (derived.length === 0) return { created: 0, flags: [] };

  const rows = derived.map((f) => ({
    workspace_id: ctx.workspaceId,
    use_case_id: ctx.useCaseId,
    roadmap_entry_id: ctx.roadmapEntryId,
    rule_code: f.rule_code,
    rule_source: f.rule_source,
    severity: f.severity,
    status: "open" as const,
    created_by: ctx.actorId,
  }));

  // UNIQUE(use_case_id, rule_code) makes this idempotent across re-runs and
  // across both generation paths (post-approval + stage transition).
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("governance_flags")
    .upsert(rows, { onConflict: "use_case_id,rule_code", ignoreDuplicates: true })
    .select("id, rule_code");
  if (insErr) throw new Error(insErr.message);
  if (!inserted || inserted.length === 0) return { created: 0, flags: [] };

  const auditRows = inserted.map((row) => {
    const meta = derived.find((d) => d.rule_code === row.rule_code)?.metadata ?? {};
    return {
      workspace_id: ctx.workspaceId,
      actor_id: ctx.actorId,
      action_type: "governance_flag_created",
      entity_type: "governance_flag",
      entity_id: row.id,
      entity_label: `${row.rule_code} · ${ctx.useCaseName}`,
      metadata: { ...meta, use_case_id: ctx.useCaseId, source: ctx.source },
    };
  });
  await supabaseAdmin.from("audit_log").insert(auditRows);

  await notifyGovernanceFlagsCreated({
    workspaceId: ctx.workspaceId,
    workspaceSlug: ctx.workspaceSlug,
    useCaseId: ctx.useCaseId,
    useCaseName: ctx.useCaseName,
    ruleCodes: inserted.map((r) => r.rule_code),
    actorId: ctx.actorId,
  });

  return { created: inserted.length, flags: inserted.map((r) => r.rule_code) };
}

const Input = z.object({ useCaseId: z.string().uuid() });

export async function deriveAndPersistGovernanceFlagsForUseCase(args: {
  useCaseId: string;
  actorId: string;
  source?: string;
}) {
  const { data: uc, error: ucErr } = await supabaseAdmin
    .from("use_cases")
    .select("id, workspace_id, function, name, workspaces(slug)")
    .eq("id", args.useCaseId)
    .single();
  if (ucErr || !uc) throw new Error(ucErr?.message ?? "Use case not found");

  const [{ data: score }, { data: captures }] = await Promise.all([
    supabaseAdmin
      .from("use_case_scores")
      .select("reason_codes")
      .eq("use_case_id", uc.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("use_case_captures")
      .select("responses")
      .eq("use_case_id", uc.id),
  ]);

  const mergedCapture: Record<string, unknown> = {};
  for (const c of captures ?? []) {
    Object.assign(mergedCapture, (c.responses ?? {}) as Record<string, unknown>);
  }

  const { data: entry } = await supabaseAdmin
    .from("roadmap_entries")
    .select("id")
    .eq("use_case_id", uc.id)
    .maybeSingle();

  const derived = deriveGovernanceFlags({
    useCaseFunction: uc.function,
    reasonCodes: (score?.reason_codes ?? []) as string[],
    capture: mergedCapture,
  });

  return persistDerivedFlags(derived, {
    workspaceId: uc.workspace_id,
    workspaceSlug: uc.workspaces?.slug ?? "",
    useCaseId: uc.id,
    useCaseName: uc.name,
    actorId: args.actorId,
    roadmapEntryId: entry?.id ?? null,
    source: args.source ?? "build_approval",
  });
}

/**
 * Derive and upsert governance flags for an approved use case.
 * Idempotent via UNIQUE(use_case_id, rule_code). Also writes audit_log entries
 * for newly created flags. Designed to be called by the client right after
 * a successful Build approval.
 */
export const generateGovernanceFlagsForUseCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    return deriveAndPersistGovernanceFlagsForUseCase({
      useCaseId: data.useCaseId,
      actorId: context.userId,
      source: "build_approval",
    });
  });

// =====================================================================
// moveRoadmapEntry — centralized stage transition with rule enforcement
// =====================================================================

const MoveInput = z.object({
  entryId: z.string().uuid(),
  toStage: z.enum(ROADMAP_STAGES),
  reason: z.string().max(2000).optional(),
  acknowledgedRequiresAction: z.boolean().optional(),
});

export type MoveResult =
  | { ok: true; from: RoadmapStage; to: RoadmapStage }
  | {
      ok: false;
      code:
        | "not_admin"
        | "not_found"
        | "hard_stop_blocked"
        | "requires_action_unacknowledged"
        | "pilot_review_required"
        | "stage_gate_failed"
        | "no_change";
      message: string;
      blockingFlags?: Array<{ id: string; severity: string }>;
      gateErrors?: string[];
    };

export const moveRoadmapEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => MoveInput.parse(input))
  .handler(async ({ data, context }): Promise<MoveResult> => {
    const { supabase, userId } = context;

    // Load entry + workspace + use case
    const { data: entry, error: entryErr } = await supabase
      .from("roadmap_entries")
      .select("id, workspace_id, use_case_id, stage, owner_id, use_cases(name), workspaces(slug)")
      .eq("id", data.entryId)
      .maybeSingle();
    if (entryErr || !entry) {
      return { ok: false, code: "not_found", message: "Roadmap entry not found" };
    }

    const fromStage = entry.stage as RoadmapStage;
    const toStage = data.toStage;
    if (fromStage === toStage) {
      return { ok: false, code: "no_change", message: "Already in that stage" };
    }

    // Admin check
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", entry.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    if (!isAdmin) {
      return { ok: false, code: "not_admin", message: "Only workspace admins can move roadmap entries" };
    }

    // Governance checks
    const { data: openFlags } = await supabase
      .from("governance_flags")
      .select("id, severity, status")
      .eq("use_case_id", entry.use_case_id)
      .in("status", ["open", "in_progress"]);

    const hardStops = (openFlags ?? []).filter((f) => f.severity === "hard_stop");
    const requiresAction = (openFlags ?? []).filter((f) => f.severity === "requires_action");

    const useCaseName = entry.use_cases?.name ?? "Use case";

    const { data: latestScore } = await supabase
      .from("use_case_scores")
      .select("id, classification, priority, delivery_readiness")
      .eq("use_case_id", entry.use_case_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stageGateErrors = validateRoadmapStageGate({
      fromStage,
      toStage,
      ownerId: entry.owner_id,
      latestScore,
      openFlags: openFlags ?? [],
    });

    if (stageGateErrors.length > 0) {
      await supabaseAdmin.from("audit_log").insert({
        workspace_id: entry.workspace_id,
        actor_id: userId,
        action_type: "roadmap_transition_blocked",
        entity_type: "roadmap_entry",
        entity_id: entry.id,
        entity_label: useCaseName,
        metadata: {
          use_case_id: entry.use_case_id,
          attempted_from_stage: fromStage,
          attempted_to_stage: toStage,
          reason: "stage_gate_failed",
          gate_errors: stageGateErrors,
        },
      });
      await notifyTransitionBlocked({
        workspaceId: entry.workspace_id,
        workspaceSlug: entry.workspaces?.slug ?? "",
        useCaseId: entry.use_case_id,
        useCaseName: useCaseName,
        roadmapEntryId: entry.id,
        attemptedFromStage: fromStage,
        attemptedToStage: toStage,
        actorId: userId,
      });
      return {
        ok: false,
        code: "stage_gate_failed",
        message: stageGateErrors[0] ?? "Roadmap stage gate failed.",
        gateErrors: stageGateErrors,
      };
    }

    if (hardStops.length > 0) {
      // Audit the blocked attempt
      await supabaseAdmin.from("audit_log").insert({
        workspace_id: entry.workspace_id,
        actor_id: userId,
        action_type: "roadmap_transition_blocked",
        entity_type: "roadmap_entry",
        entity_id: entry.id,
        entity_label: useCaseName,
        metadata: {
          use_case_id: entry.use_case_id,
          attempted_from_stage: fromStage,
          attempted_to_stage: toStage,
          blocking_flags: hardStops.map((f) => ({ id: f.id, severity: f.severity })),
          reason: "hard_stop_governance_flag",
        },
      });
      await notifyTransitionBlocked({
        workspaceId: entry.workspace_id,
        workspaceSlug: entry.workspaces?.slug ?? "",
        useCaseId: entry.use_case_id,
        useCaseName: useCaseName,
        roadmapEntryId: entry.id,
        attemptedFromStage: fromStage,
        attemptedToStage: toStage,
        actorId: userId,
      });
      return {
        ok: false,
        code: "hard_stop_blocked",
        message: "Resolve hard-stop governance flags before advancing.",
        blockingFlags: hardStops,
      };
    }

    if (requiresAction.length > 0 && !data.acknowledgedRequiresAction) {
      return {
        ok: false,
        code: "requires_action_unacknowledged",
        message: "Acknowledge open governance actions before advancing.",
        blockingFlags: requiresAction,
      };
    }

    // Pilot → Production requires a recent post-pilot review recommending production
    if (fromStage === "pilot" && toStage === "production") {
      const { data: latestReview } = await supabase
        .from("post_pilot_reviews")
        .select("recommendation, submitted_at")
        .eq("use_case_id", entry.use_case_id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestReview || latestReview.recommendation !== "promote_to_production") {
        return {
          ok: false,
          code: "pilot_review_required",
          message:
            "Submit a pilot review recommending production before promoting this use case.",
        };
      }
    }

    // Commit the transition
    const { error: updErr } = await supabase
      .from("roadmap_entries")
      .update({ stage: toStage })
      .eq("id", entry.id);
    if (updErr) throw new Error(updErr.message);

    const { error: histErr } = await supabase
      .from("roadmap_stage_history")
      .insert({
        workspace_id: entry.workspace_id,
        roadmap_entry_id: entry.id,
        use_case_id: entry.use_case_id,
        from_stage: fromStage,
        to_stage: toStage,
        reason: data.reason?.trim() || null,
        changed_by: userId,
      });
    if (histErr) throw new Error(histErr.message);

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: entry.workspace_id,
      actor_id: userId,
      action_type: "roadmap_stage_changed",
      entity_type: "roadmap_entry",
      entity_id: entry.id,
      entity_label: useCaseName,
      before_state: { stage: fromStage },
      after_state: { stage: toStage },
      metadata: {
        use_case_id: entry.use_case_id,
        from_stage: fromStage,
        to_stage: toStage,
        reason: data.reason ?? null,
        acknowledged_requires_action: !!data.acknowledgedRequiresAction,
      },
    });

    await notifyRoadmapStageChanged({
      workspaceId: entry.workspace_id,
      workspaceSlug: entry.workspaces?.slug ?? "",
      useCaseId: entry.use_case_id,
      useCaseName: useCaseName,
      roadmapEntryId: entry.id,
      fromStage,
      toStage,
      ownerId: entry.owner_id,
      actorId: userId,
    });

    // Stage-driven governance flags (SDAIA technical documentation on reaching
    // production, CHANGE_MANAGEMENT on Pilot -> Production). Idempotent via
    // the (use_case_id, rule_code) unique constraint, so re-entry is safe.
    try {
      const { data: uc } = await supabaseAdmin
        .from("use_cases")
        .select("function")
        .eq("id", entry.use_case_id)
        .maybeSingle();
      const { data: captures } = await supabaseAdmin
        .from("use_case_captures")
        .select("responses")
        .eq("use_case_id", entry.use_case_id);
      const mergedCapture: Record<string, unknown> = {};
      for (const c of captures ?? []) {
        Object.assign(mergedCapture, (c.responses ?? {}) as Record<string, unknown>);
      }
      const { data: score } = await supabaseAdmin
        .from("use_case_scores")
        .select("reason_codes")
        .eq("use_case_id", entry.use_case_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const stageDerived = deriveGovernanceFlags({
        useCaseFunction: uc?.function ?? null,
        reasonCodes: (score?.reason_codes ?? []) as string[],
        capture: mergedCapture,
        stage: toStage,
        fromStage,
      }).filter(
        // Only persist the stage-driven additions here. Capture/score-driven
        // flags were already seeded by generateGovernanceFlagsForUseCase on
        // approval; re-running them is harmless (idempotent) but noisy in
        // notifications, so we narrow to the two stage-only codes.
        (f) =>
          f.rule_code === "SDAIA_TECHNICAL_DOCUMENTATION" ||
          f.rule_code === "CHANGE_MANAGEMENT",
      );
      if (stageDerived.length > 0) {
        await persistDerivedFlags(stageDerived, {
          workspaceId: entry.workspace_id,
          workspaceSlug: entry.workspaces?.slug ?? "",
          useCaseId: entry.use_case_id,
          useCaseName,
          actorId: userId,
          roadmapEntryId: entry.id,
          source: `stage_transition:${fromStage}->${toStage}`,
        });
      }
    } catch (e) {
      // Don't fail the transition if stage-flag creation hiccups; surface in logs.
      console.error("stage-driven governance flag creation failed", e);
    }

    return { ok: true, from: fromStage, to: toStage };
  });

function validateRoadmapStageGate(input: {
  fromStage: RoadmapStage;
  toStage: RoadmapStage;
  ownerId: string | null;
  latestScore: {
    id: string;
    classification: string | null;
    priority: number | null;
    delivery_readiness: number | null;
  } | null;
  openFlags: Array<{ id: string; severity: string; status: string }>;
}): string[] {
  const order: Record<RoadmapStage, number> = {
    backlog: 0,
    pilot: 1,
    production: 2,
    scaling: 3,
    retired: 4,
  };
  if (order[input.toStage] <= order[input.fromStage] || input.toStage === "retired") {
    return [];
  }

  const errors: string[] = [];
  const unresolvedReviewFlags = input.openFlags.filter(
    (f) =>
      (f.severity === "hard_stop" || f.severity === "requires_action") &&
      (f.status === "open" || f.status === "in_progress"),
  );

  if (input.toStage === "pilot") {
    if (!input.ownerId) errors.push("Assign an owner before starting a pilot.");
    if (!input.latestScore) errors.push("Score the use case before starting a pilot.");
    if (input.latestScore?.classification === "Not Ready") {
      errors.push("Not Ready use cases must be reshaped before pilot.");
    }
  }

  if (input.toStage === "production") {
    if (!input.ownerId) errors.push("Production requires an accountable owner.");
    if (!input.latestScore) errors.push("Production requires an official use-case score.");
    if ((input.latestScore?.delivery_readiness ?? 0) < 50) {
      errors.push("Delivery readiness is too low for production.");
    }
  }

  if (input.toStage === "scaling") {
    if (!input.ownerId) errors.push("Scaling requires a named service owner.");
    if (unresolvedReviewFlags.length > 0) {
      errors.push("Resolve or formally accept blocker/action governance flags before scaling.");
    }
  }

  return errors;
}

// =====================================================================
// Governance flag mutations
// =====================================================================

const FLAG_STATUSES = ["open", "in_progress", "resolved", "accepted_risk", "not_applicable"] as const;
type FlagStatus = (typeof FLAG_STATUSES)[number];

const ALLOWED_FLAG_TRANSITIONS: Record<FlagStatus, FlagStatus[]> = {
  open: ["in_progress", "resolved", "accepted_risk", "not_applicable"],
  in_progress: ["resolved", "accepted_risk", "not_applicable", "open"],
  resolved: ["in_progress"],
  accepted_risk: ["in_progress"],
  not_applicable: ["in_progress"],
};

const UpdateFlagInput = z.object({
  flagId: z.string().uuid(),
  status: z.enum(FLAG_STATUSES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().max(4000).nullable().optional(),
});

export type UpdateFlagResult =
  | { ok: true }
  | { ok: false; code: "not_admin" | "not_found" | "invalid_transition" | "no_change"; message: string };

export const updateGovernanceFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateFlagInput.parse(input))
  .handler(async ({ data, context }): Promise<UpdateFlagResult> => {
    const { supabase, userId } = context;

    const { data: flag, error: flagErr } = await supabase
      .from("governance_flags")
      .select("id, workspace_id, use_case_id, roadmap_entry_id, rule_code, status, assignee_id, resolution_notes, use_cases(name), workspaces(slug)")
      .eq("id", data.flagId)
      .maybeSingle();
    if (flagErr || !flag) return { ok: false, code: "not_found", message: "Flag not found" };

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", flag.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    if (!isAdmin) return { ok: false, code: "not_admin", message: "Only workspace admins can update flags" };

    const statusChanged = data.status !== undefined && data.status !== flag.status;
    const assigneeChanged = data.assigneeId !== undefined && data.assigneeId !== flag.assignee_id;
    const notesChanged =
      data.resolutionNotes !== undefined && (data.resolutionNotes ?? null) !== (flag.resolution_notes ?? null);

    if (!statusChanged && !assigneeChanged && !notesChanged) {
      return { ok: false, code: "no_change", message: "Nothing to update" };
    }

    if (statusChanged) {
      const allowed = ALLOWED_FLAG_TRANSITIONS[flag.status as FlagStatus] ?? [];
      if (!allowed.includes(data.status!)) {
        return {
          ok: false,
          code: "invalid_transition",
          message: `Cannot move from ${flag.status} to ${data.status}.`,
        };
      }
    }

    const patch: Record<string, unknown> = {};
    if (statusChanged) patch.status = data.status;
    if (assigneeChanged) patch.assignee_id = data.assigneeId;
    if (notesChanged) patch.resolution_notes = data.resolutionNotes;

    const { error: updErr } = await supabase
      .from("governance_flags")
      .update(patch as never)
      .eq("id", flag.id);
    if (updErr) throw new Error(updErr.message);

    const useCaseName = flag.use_cases?.name ?? "Use case";
    const label = `${flag.rule_code} · ${useCaseName}`;
    const auditRows: Array<Record<string, unknown>> = [];
    const baseMeta = { use_case_id: flag.use_case_id, roadmap_entry_id: flag.roadmap_entry_id };

    if (statusChanged) {
      auditRows.push({
        workspace_id: flag.workspace_id,
        actor_id: userId,
        action_type: "governance_flag_status_changed",
        entity_type: "governance_flag",
        entity_id: flag.id,
        entity_label: label,
        before_state: { status: flag.status },
        after_state: { status: data.status },
        metadata: baseMeta,
      });
    }
    if (assigneeChanged) {
      auditRows.push({
        workspace_id: flag.workspace_id,
        actor_id: userId,
        action_type: "governance_flag_assigned",
        entity_type: "governance_flag",
        entity_id: flag.id,
        entity_label: label,
        before_state: { assignee_id: flag.assignee_id },
        after_state: { assignee_id: data.assigneeId },
        metadata: baseMeta,
      });
    }
    if (notesChanged) {
      auditRows.push({
        workspace_id: flag.workspace_id,
        actor_id: userId,
        action_type: "governance_flag_notes_updated",
        entity_type: "governance_flag",
        entity_id: flag.id,
        entity_label: label,
        before_state: { resolution_notes: flag.resolution_notes },
        after_state: { resolution_notes: data.resolutionNotes },
        metadata: baseMeta,
      });
    }
    if (auditRows.length > 0) await supabaseAdmin.from("audit_log").insert(auditRows as never);

    const workspaceSlug = flag.workspaces?.slug ?? "";
    if (assigneeChanged && data.assigneeId) {
      await notifyFlagAssigned({
        workspaceId: flag.workspace_id,
        workspaceSlug,
        flagId: flag.id,
        ruleCode: flag.rule_code,
        useCaseName,
        assigneeId: data.assigneeId,
        actorId: userId,
      });
    }
    if (statusChanged && data.status && isResolutionStatus(data.status)) {
      await notifyFlagResolved({
        workspaceId: flag.workspace_id,
        workspaceSlug,
        flagId: flag.id,
        ruleCode: flag.rule_code,
        useCaseName,
        resolutionStatus: data.status,
        actorId: userId,
      });
    }
    return { ok: true };
  });

const BulkInput = z.object({ workspaceId: z.string().uuid() });

export const bulkMarkAdvisoryNotApplicable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BulkInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    if (!isAdmin) return { ok: false as const, code: "not_admin", changed: 0 };

    const { data: targets, error: selErr } = await supabase
      .from("governance_flags")
      .select("id, status, resolution_notes, rule_code, use_case_id, roadmap_entry_id, use_cases(name)")
      .eq("workspace_id", data.workspaceId)
      .eq("severity", "advisory")
      .in("status", ["open", "in_progress"]);
    if (selErr) throw new Error(selErr.message);
    if (!targets || targets.length === 0) return { ok: true as const, changed: 0 };

    const note = "Bulk marked as not applicable by admin.";
    const ids = targets.map((t) => t.id);
    const { error: updErr } = await supabase
      .from("governance_flags")
      .update({ status: "not_applicable", resolution_notes: note })
      .in("id", ids);
    if (updErr) throw new Error(updErr.message);

    const auditRows = targets.map((t) => ({
      workspace_id: data.workspaceId,
      actor_id: userId,
      action_type: "governance_flag_status_changed",
      entity_type: "governance_flag",
      entity_id: t.id,
      entity_label: `${t.rule_code} · ${t.use_cases?.name ?? "Use case"}`,
      before_state: { status: t.status, resolution_notes: t.resolution_notes },
      after_state: { status: "not_applicable", resolution_notes: note },
      metadata: {
        use_case_id: t.use_case_id,
        roadmap_entry_id: t.roadmap_entry_id,
        bulk: true,
        bulk_action: "advisory_not_applicable",
      },
    }));
    await supabaseAdmin.from("audit_log").insert(auditRows);

    return { ok: true as const, changed: targets.length };
  });

// =====================================================================
// submitPostPilotReview — insert + audit log
// =====================================================================

const ReviewInput = z.object({
  useCaseId: z.string().uuid(),
  accuracyScore: z.number().min(0).max(100).nullable().optional(),
  timeSavedHoursPerWeek: z.number().min(0).max(1000).nullable().optional(),
  errorRatePercent: z.number().min(0).max(100).nullable().optional(),
  reviewerLoad: z.enum(["reduced", "unchanged", "increased"]).nullable().optional(),
  userSatisfaction: z.enum(["positive", "neutral", "negative"]).nullable().optional(),
  recommendation: z.enum(["promote_to_production", "extend_pilot", "redesign", "retire"]),
  evidenceNotes: z.string().trim().min(10).max(4000),
});

export type SubmitReviewResult =
  | { ok: true; id: string }
  | { ok: false; code: "not_member" | "not_found"; message: string };

export const submitPostPilotReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ReviewInput.parse(input))
  .handler(async ({ data, context }): Promise<SubmitReviewResult> => {
    const { supabase, userId } = context;

    const { data: uc, error: ucErr } = await supabase
      .from("use_cases")
      .select("id, name, workspace_id, workspaces(slug)")
      .eq("id", data.useCaseId)
      .maybeSingle();
    if (ucErr || !uc) return { ok: false, code: "not_found", message: "Use case not found" };

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", uc.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { ok: false, code: "not_member", message: "Not a workspace member" };

    const { data: entry } = await supabase
      .from("roadmap_entries")
      .select("id")
      .eq("use_case_id", uc.id)
      .maybeSingle();

    const { data: inserted, error: insErr } = await supabase
      .from("post_pilot_reviews")
      .insert({
        workspace_id: uc.workspace_id,
        use_case_id: uc.id,
        roadmap_entry_id: entry?.id ?? null,
        submitted_by: userId,
        accuracy_score: data.accuracyScore ?? null,
        time_saved_hours_per_week: data.timeSavedHoursPerWeek ?? null,
        error_rate_percent: data.errorRatePercent ?? null,
        reviewer_load: data.reviewerLoad ?? null,
        user_satisfaction: data.userSatisfaction ?? null,
        recommendation: data.recommendation,
        evidence_notes: data.evidenceNotes,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Failed to insert review");

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: uc.workspace_id,
      actor_id: userId,
      action_type: "post_pilot_review_submitted",
      entity_type: "post_pilot_review",
      entity_id: inserted.id,
      entity_label: uc.name,
      metadata: {
        use_case_id: uc.id,
        roadmap_entry_id: entry?.id ?? null,
        recommendation: data.recommendation,
        accuracy_score: data.accuracyScore ?? null,
        time_saved_hours_per_week: data.timeSavedHoursPerWeek ?? null,
        error_rate_percent: data.errorRatePercent ?? null,
      },
    });

    await notifyPostPilotReview({
      workspaceId: uc.workspace_id,
      workspaceSlug: uc.workspaces?.slug ?? "",
      useCaseId: uc.id,
      useCaseName: uc.name,
      reviewId: inserted.id,
      recommendation: data.recommendation,
      actorId: userId,
    });
    return { ok: true, id: inserted.id };
  });

// =====================================================================
// updateRoadmapEntry — admin edit of owner_id and target_quarter
// =====================================================================

const UpdateInput = z.object({
  entryId: z.string().uuid(),
  ownerId: z.string().uuid().nullable().optional(),
  targetQuarter: z
    .string()
    .trim()
    .max(16)
    .regex(/^(\d{4}-Q[1-4]|)$/, "Expected format YYYY-Q1..Q4 or empty")
    .nullable()
    .optional(),
});

export type UpdateRoadmapEntryResult =
  | { ok: true }
  | { ok: false; code: "not_admin" | "not_found" | "invalid"; message: string };

export const updateRoadmapEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data, context }): Promise<UpdateRoadmapEntryResult> => {
    const { supabase, userId } = context;

    const { data: entry, error: entryErr } = await supabase
      .from("roadmap_entries")
      .select("id, workspace_id, use_case_id, owner_id, target_quarter, use_cases(name)")
      .eq("id", data.entryId)
      .maybeSingle();
    if (entryErr || !entry) {
      return { ok: false, code: "not_found", message: "Roadmap entry not found" };
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", entry.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    if (!isAdmin) {
      return { ok: false, code: "not_admin", message: "Only workspace admins can edit roadmap entries" };
    }

    // Validate that the proposed owner is actually a workspace member.
    if (data.ownerId) {
      const { data: ownerMembership } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", entry.workspace_id)
        .eq("user_id", data.ownerId)
        .maybeSingle();
      if (!ownerMembership) {
        return { ok: false, code: "invalid", message: "Owner must be a workspace member" };
      }
    }

    const patch: { owner_id?: string | null; target_quarter?: string | null } = {};
    if (data.ownerId !== undefined) patch.owner_id = data.ownerId;
    if (data.targetQuarter !== undefined) {
      const v = data.targetQuarter;
      patch.target_quarter = v && v.length > 0 ? v : null;
    }
    if (Object.keys(patch).length === 0) {
      return { ok: true };
    }

    const { error: updErr } = await supabase
      .from("roadmap_entries")
      .update(patch)
      .eq("id", entry.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: entry.workspace_id,
      actor_id: userId,
      action_type: "roadmap_entry_updated",
      entity_type: "roadmap_entry",
      entity_id: entry.id,
      entity_label: entry.use_cases?.name ?? "Roadmap entry",
      before_state: { owner_id: entry.owner_id, target_quarter: entry.target_quarter },
      after_state: {
        owner_id: patch.owner_id ?? entry.owner_id,
        target_quarter: patch.target_quarter ?? entry.target_quarter,
      },
      metadata: { use_case_id: entry.use_case_id },
    });

    return { ok: true };
  });

// =====================================================================
// generateEvidencePack — server-owned client evidence export
// =====================================================================

const EvidencePackInput = z.object({
  workspaceId: z.string().uuid(),
});

export const generateEvidencePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EvidencePackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!membership) throw new Error("Not a workspace member");

    const [
      workspaceRes,
      roadmapRes,
      flagsRes,
      scoreSnapshotsRes,
      assessmentRes,
      auditRes,
      historyRes,
      reviewsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("workspaces")
        .select("id, name, slug, workspace_profile, use_case_profile, worked_example")
        .eq("id", data.workspaceId)
        .single(),
      supabaseAdmin
        .from("roadmap_entries")
        .select(
          "id, use_case_id, owner_id, stage, target_quarter, priority_score, source_metadata, gate_status, evidence_summary, created_at, updated_at, use_cases(id, name, function, description, status), use_case_scores(*)",
        )
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("governance_flags")
        .select("*")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("use_case_score_snapshots")
        .select("id, use_case_id, score_type, scoring_model_version, input_hash, computed_outputs, reason_codes, confidence, computed_at")
        .eq("workspace_id", data.workspaceId)
        .order("computed_at", { ascending: false }),
      supabaseAdmin
        .from("assessment_score_snapshots")
        .select("id, score_type, scoring_model_version, input_hash, computed_outputs, reason_codes, confidence, computed_at")
        .eq("workspace_id", data.workspaceId)
        .order("computed_at", { ascending: false })
        .limit(3),
      supabaseAdmin
        .from("audit_log")
        .select("id, action_type, entity_type, entity_id, entity_label, metadata, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(250),
      supabaseAdmin
        .from("roadmap_stage_history")
        .select("id, roadmap_entry_id, use_case_id, from_stage, to_stage, reason, changed_by, changed_at")
        .eq("workspace_id", data.workspaceId)
        .order("changed_at", { ascending: false }),
      supabaseAdmin
        .from("post_pilot_reviews")
        .select("*")
        .eq("workspace_id", data.workspaceId)
        .order("submitted_at", { ascending: false }),
    ]);

    const error =
      workspaceRes.error ??
      roadmapRes.error ??
      flagsRes.error ??
      scoreSnapshotsRes.error ??
      assessmentRes.error ??
      auditRes.error ??
      historyRes.error ??
      reviewsRes.error;
    if (error) throw new Error(error.message);

    const activeFlags = (flagsRes.data ?? []).filter((flag) =>
      ["open", "in_progress"].includes(flag.status),
    );
    const pack = {
      generated_at: new Date().toISOString(),
      generated_by: userId,
      workspace: workspaceRes.data,
      summary: {
        roadmap_entries: roadmapRes.data?.length ?? 0,
        active_governance_flags: activeFlags.length,
        blocker_flags: activeFlags.filter((flag) => flag.severity === "hard_stop").length,
        score_snapshots: scoreSnapshotsRes.data?.length ?? 0,
        audit_events: auditRes.data?.length ?? 0,
      },
      assessment_report: assessmentRes.data?.[0] ?? null,
      use_case_portfolio: roadmapRes.data ?? [],
      priority_matrix: (scoreSnapshotsRes.data ?? []).map((snapshot) => ({
        use_case_id: snapshot.use_case_id,
        scoring_model_version: snapshot.scoring_model_version,
        input_hash: snapshot.input_hash,
        confidence: snapshot.confidence,
        computed_at: snapshot.computed_at,
        outputs: snapshot.computed_outputs,
      })),
      governance_flag_register: flagsRes.data ?? [],
      roadmap_plan: roadmapRes.data ?? [],
      roadmap_stage_history: historyRes.data ?? [],
      pilot_reviews: reviewsRes.data ?? [],
      audit_log: auditRes.data ?? [],
      evidence_checklist: [
        "Assessment score snapshot and maturity rationale",
        "Use-case score snapshots with reason codes",
        "Priority matrix and official classifications",
        "KSA governance flag register with reviewer and evidence requirements",
        "Roadmap stage history and blocked transition events",
        "Pilot review evidence before production promotion",
        "Closure or accepted-risk notes for active deployment blockers",
      ],
    };

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: data.workspaceId,
      actor_id: userId,
      action_type: "evidence_pack_generated",
      entity_type: "workspace",
      entity_id: data.workspaceId,
      entity_label: workspaceRes.data?.name ?? "Workspace",
      metadata: {
        active_governance_flags: activeFlags.length,
        roadmap_entries: roadmapRes.data?.length ?? 0,
        score_snapshots: scoreSnapshotsRes.data?.length ?? 0,
      },
    } as never);

    return pack;
  });
