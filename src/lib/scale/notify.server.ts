/**
 * Scale notification helpers. Uses the admin client because the notifications
 * table has no client-facing INSERT policy — only trigger functions and
 * server-side helpers may write notifications.
 *
 * All helpers are best-effort: notification failures are logged but never
 * thrown, so they don't break the underlying business action.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNotificationEmails } from "@/lib/notifications/email.server";

type Kind =
  | "invitation_accepted"
  | "roadmap_added"
  | "roadmap_stage_changed"
  | "roadmap_transition_blocked"
  | "governance_flag_created"
  | "governance_flag_assigned"
  | "governance_flag_resolved"
  | "post_pilot_review_submitted";

type NotificationRow = {
  recipient_user_id: string;
  workspace_id: string;
  kind: Kind;
  payload: Record<string, unknown>;
};

async function getWorkspaceAdminIds(workspaceId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .in("role", ["owner", "admin"]);
  if (error) {
    console.error("[notify] failed to load admins", error);
    return [];
  }
  return (data ?? []).map((m) => m.user_id);
}

async function insertNotifications(rows: NotificationRow[]) {
  if (rows.length === 0) return;
  // Dedupe by recipient — never send the same event twice to the same user.
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = `${r.recipient_user_id}:${r.kind}:${JSON.stringify(r.payload)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const { error } = await supabaseAdmin
    .from("notifications")
    .insert(deduped as never);
  if (error) {
    console.error("[notify] insert failed", error);
    return;
  }
  // Best-effort email fan-out, gated by per-user notification_preferences.
  try {
    await sendNotificationEmails(
      deduped.map((r) => {
        const subjectAndText = formatEmail(r);
        return {
          recipient_user_id: r.recipient_user_id,
          workspace_id: r.workspace_id,
          kind: r.kind,
          subject: subjectAndText.subject,
          text: subjectAndText.text,
        };
      }),
    );
  } catch (e) {
    console.error("[notify] email fan-out failed", e);
  }
}

function formatEmail(r: NotificationRow): { subject: string; text: string } {
  const p = r.payload as Record<string, unknown>;
  const useCaseName = (p.use_case_name as string | undefined) ?? "A use case";
  const stage = (s: unknown) =>
    typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "";
  switch (r.kind) {
    case "invitation_accepted":
      return {
        subject: "Invitation accepted",
        text: `${(p.accepted_email as string) ?? "Someone"} accepted your workspace invitation.`,
      };
    case "roadmap_added":
      return { subject: `${useCaseName} added to roadmap`, text: `${useCaseName} was added to the Scale roadmap.` };
    case "roadmap_stage_changed":
      return {
        subject: `${useCaseName}: ${stage(p.from_stage)} → ${stage(p.to_stage)}`,
        text: `${useCaseName} moved from ${stage(p.from_stage)} to ${stage(p.to_stage)}.`,
      };
    case "roadmap_transition_blocked":
      return {
        subject: `Stage change blocked on ${useCaseName}`,
        text: `Hard-stop governance flags must be resolved before this transition.`,
      };
    case "governance_flag_created": {
      const codes = Array.isArray(p.rule_codes) ? (p.rule_codes as string[]) : [];
      return {
        subject: `Governance flag on ${useCaseName}`,
        text: `${codes.join(", ") || "Flag"} raised on ${useCaseName}.`,
      };
    }
    case "governance_flag_assigned":
      return {
        subject: `Governance flag assigned to you`,
        text: `${(p.rule_code as string) ?? "A flag"} on ${useCaseName} was assigned to you.`,
      };
    case "governance_flag_resolved":
      return {
        subject: `Governance flag ${stage(p.resolution_status)}`,
        text: `${(p.rule_code as string) ?? "A flag"} on ${useCaseName} marked ${stage(p.resolution_status)}.`,
      };
    case "post_pilot_review_submitted":
      return {
        subject: `Pilot review submitted: ${useCaseName}`,
        text: `A pilot review was submitted for ${useCaseName}.`,
      };
    default:
      return { subject: "Notification", text: r.kind };
  }
}

function dedupeRecipients(...lists: Array<Array<string | null | undefined>>): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    for (const id of list) if (id) set.add(id);
  }
  return Array.from(set);
}

export async function notifyRoadmapStageChanged(args: {
  workspaceId: string;
  workspaceSlug: string;
  useCaseId: string;
  useCaseName: string;
  roadmapEntryId: string;
  fromStage: string;
  toStage: string;
  ownerId: string | null;
  actorId: string | null;
}) {
  const adminIds = await getWorkspaceAdminIds(args.workspaceId);
  // Recipients = owner + admins, minus actor.
  const recipients = dedupeRecipients([args.ownerId], adminIds).filter(
    (id) => id !== args.actorId,
  );
  const payload = {
    use_case_id: args.useCaseId,
    use_case_name: args.useCaseName,
    roadmap_entry_id: args.roadmapEntryId,
    from_stage: args.fromStage,
    to_stage: args.toStage,
    workspace_slug: args.workspaceSlug,
  };
  await insertNotifications(
    recipients.map((rid) => ({
      recipient_user_id: rid,
      workspace_id: args.workspaceId,
      kind: "roadmap_stage_changed",
      payload,
    })),
  );
}

export async function notifyTransitionBlocked(args: {
  workspaceId: string;
  workspaceSlug: string;
  useCaseId: string;
  useCaseName: string;
  roadmapEntryId: string;
  attemptedFromStage: string;
  attemptedToStage: string;
  actorId: string;
}) {
  await insertNotifications([
    {
      recipient_user_id: args.actorId,
      workspace_id: args.workspaceId,
      kind: "roadmap_transition_blocked",
      payload: {
        use_case_id: args.useCaseId,
        use_case_name: args.useCaseName,
        roadmap_entry_id: args.roadmapEntryId,
        from_stage: args.attemptedFromStage,
        to_stage: args.attemptedToStage,
        workspace_slug: args.workspaceSlug,
      },
    },
  ]);
}

export async function notifyGovernanceFlagsCreated(args: {
  workspaceId: string;
  workspaceSlug: string;
  useCaseId: string;
  useCaseName: string;
  ruleCodes: string[];
  actorId: string | null;
}) {
  if (args.ruleCodes.length === 0) return;
  const adminIds = (await getWorkspaceAdminIds(args.workspaceId)).filter(
    (id) => id !== args.actorId,
  );
  const payload = {
    use_case_id: args.useCaseId,
    use_case_name: args.useCaseName,
    rule_codes: args.ruleCodes,
    workspace_slug: args.workspaceSlug,
  };
  await insertNotifications(
    adminIds.map((rid) => ({
      recipient_user_id: rid,
      workspace_id: args.workspaceId,
      kind: "governance_flag_created",
      payload,
    })),
  );
}

export async function notifyFlagAssigned(args: {
  workspaceId: string;
  workspaceSlug: string;
  flagId: string;
  ruleCode: string;
  useCaseName: string;
  assigneeId: string;
  actorId: string | null;
}) {
  if (args.assigneeId === args.actorId) return;
  await insertNotifications([
    {
      recipient_user_id: args.assigneeId,
      workspace_id: args.workspaceId,
      kind: "governance_flag_assigned",
      payload: {
        flag_id: args.flagId,
        rule_code: args.ruleCode,
        use_case_name: args.useCaseName,
        workspace_slug: args.workspaceSlug,
      },
    },
  ]);
}

export async function notifyFlagResolved(args: {
  workspaceId: string;
  workspaceSlug: string;
  flagId: string;
  ruleCode: string;
  useCaseName: string;
  resolutionStatus: string;
  actorId: string | null;
}) {
  const adminIds = (await getWorkspaceAdminIds(args.workspaceId)).filter(
    (id) => id !== args.actorId,
  );
  await insertNotifications(
    adminIds.map((rid) => ({
      recipient_user_id: rid,
      workspace_id: args.workspaceId,
      kind: "governance_flag_resolved",
      payload: {
        flag_id: args.flagId,
        rule_code: args.ruleCode,
        use_case_name: args.useCaseName,
        resolution_status: args.resolutionStatus,
        workspace_slug: args.workspaceSlug,
      },
    })),
  );
}

export async function notifyPostPilotReview(args: {
  workspaceId: string;
  workspaceSlug: string;
  useCaseId: string;
  useCaseName: string;
  reviewId: string;
  recommendation: string;
  actorId: string | null;
}) {
  const adminIds = (await getWorkspaceAdminIds(args.workspaceId)).filter(
    (id) => id !== args.actorId,
  );
  await insertNotifications(
    adminIds.map((rid) => ({
      recipient_user_id: rid,
      workspace_id: args.workspaceId,
      kind: "post_pilot_review_submitted",
      payload: {
        use_case_id: args.useCaseId,
        use_case_name: args.useCaseName,
        review_id: args.reviewId,
        recommendation: args.recommendation,
        workspace_slug: args.workspaceSlug,
      },
    })),
  );
}

const RESOLUTION_STATUSES = new Set(["resolved", "accepted_risk", "not_applicable"]);
export function isResolutionStatus(status: string): boolean {
  return RESOLUTION_STATUSES.has(status);
}
