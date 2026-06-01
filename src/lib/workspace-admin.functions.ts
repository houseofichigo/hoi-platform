import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { MODULES } from "@/lib/curriculum";

const adminDb = supabaseAdmin as any;

const WorkspaceInput = z.object({
  workspaceId: z.string().uuid(),
});

type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

async function requireWorkspaceAdmin(input: {
  supabase: any;
  userId: string;
  workspaceId: string;
}) {
  const { data, error } = await input.supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !["owner", "admin"].includes(data.role)) {
    throw new Error("Workspace admin access required");
  }
  return data.role as "owner" | "admin";
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message ?? "Count failed");
  return result.count ?? 0;
}

async function writeWorkspaceAudit(input: {
  workspaceId: string;
  actorId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  metadata?: Json;
}) {
  const { error } = await supabaseAdmin.from("audit_log").insert({
    workspace_id: input.workspaceId,
    actor_id: input.actorId,
    action_type: input.actionType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export type WorkspaceAdminOverview = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  role: "owner" | "admin";
  counts: {
    members: number;
    pendingInvites: number;
    assessComplete: number;
    assessTotal: number;
    useCases: number;
    scoredUseCases: number;
    approvedUseCases: number;
    activeRoadmap: number;
    openGovernanceFlags: number;
    pendingPilotReviews: number;
  };
  onboarding: {
    companyProfileComplete: boolean;
    useCaseProfileComplete: boolean;
    workedExampleSelected: boolean;
  };
  billing: {
    planId: string;
    status: string;
    seatLimit: number | null;
    currentPeriodEnd: string | null;
    seatUsage: {
      used: number;
      limit: number | null;
      overLimit: boolean;
    };
  };
};

export const getWorkspaceAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WorkspaceInput.parse(input))
  .handler(async ({ data, context }): Promise<WorkspaceAdminOverview> => {
    const role = await requireWorkspaceAdmin({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
    });

    const { data: workspace, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, slug, plan, workspace_profile, use_case_profile, worked_example")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) throw new Error("Workspace not found");

    const [
      members,
      pendingInvites,
      assessComplete,
      useCases,
      scoredUseCases,
      approvedUseCases,
      activeRoadmap,
      openGovernanceFlags,
      pilotRoadmap,
      pilotReviews,
      subscriptionResult,
    ] = await Promise.all([
      countRows(
        supabaseAdmin
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId),
      ),
      countRows(
        supabaseAdmin
          .from("workspace_invitations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .eq("status", "pending"),
      ),
      countRows(
        supabaseAdmin
          .from("assess_progress")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .eq("status", "completed"),
      ),
      countRows(
        supabaseAdmin
          .from("use_cases")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId),
      ),
      countRows(
        supabaseAdmin
          .from("use_cases")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .in("status", ["scored", "submitted", "approved"]),
      ),
      countRows(
        supabaseAdmin
          .from("use_cases")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .eq("status", "approved"),
      ),
      countRows(
        supabaseAdmin
          .from("roadmap_entries")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .neq("stage", "retired"),
      ),
      countRows(
        supabaseAdmin
          .from("governance_flags")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .in("status", ["open", "in_progress"]),
      ),
      adminDb
        .from("roadmap_entries")
        .select("use_case_id")
        .eq("workspace_id", data.workspaceId)
        .eq("stage", "pilot"),
      adminDb
        .from("post_pilot_reviews")
        .select("use_case_id")
        .eq("workspace_id", data.workspaceId),
      adminDb
        .from("workspace_subscriptions")
        .select("plan_id, status, seat_limit, current_period_end")
        .eq("workspace_id", data.workspaceId)
        .maybeSingle(),
    ]);

    if (pilotRoadmap.error) throw new Error(pilotRoadmap.error.message);
    if (pilotReviews.error) throw new Error(pilotReviews.error.message);
    if (subscriptionResult.error) throw new Error(subscriptionResult.error.message);

    const reviewedPilotUseCases = new Set(
      ((pilotReviews.data ?? []) as Array<{ use_case_id: string }>).map((row) => row.use_case_id),
    );
    const pendingPilotReviews = ((pilotRoadmap.data ?? []) as Array<{ use_case_id: string }>).filter(
      (row) => !reviewedPilotUseCases.has(row.use_case_id),
    ).length;

    const subscription = subscriptionResult.data as
      | { plan_id: string; status: string; seat_limit: number | null; current_period_end: string | null }
      | null;

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
      role,
      counts: {
        members,
        pendingInvites,
        assessComplete,
        assessTotal: MODULES.length,
        useCases,
        scoredUseCases,
        approvedUseCases,
        activeRoadmap,
        openGovernanceFlags,
        pendingPilotReviews,
      },
      onboarding: {
        companyProfileComplete: !!workspace.workspace_profile,
        useCaseProfileComplete: !!workspace.use_case_profile,
        workedExampleSelected: !!workspace.worked_example,
      },
      billing: {
        planId: subscription?.plan_id ?? workspace.plan,
        status: subscription?.status ?? "manual",
        seatLimit: subscription?.seat_limit ?? null,
        currentPeriodEnd: subscription?.current_period_end ?? null,
        seatUsage: {
          used: members,
          limit: subscription?.seat_limit ?? null,
          overLimit: subscription?.seat_limit != null && members > subscription.seat_limit,
        },
      },
    };
  });

export type WorkspaceAdminMember = {
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  invited_by: string | null;
  full_name: string | null;
  avatar_url: string | null;
  job_role: string | null;
  department: string | null;
  email: string | null;
  profileComplete: boolean;
  assessCompleted: number;
  assessTotal: number;
  lastActivityAt: string | null;
};

export type WorkspaceAdminInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

export type WorkspaceAdminMembersData = {
  members: WorkspaceAdminMember[];
  pendingInvitations: WorkspaceAdminInvitation[];
};

export const getWorkspaceAdminMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WorkspaceInput.parse(input))
  .handler(async ({ data, context }): Promise<WorkspaceAdminMembersData> => {
    await requireWorkspaceAdmin({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
    });

    const [{ data: members, error: membersErr }, { data: invitations, error: invitationsErr }] =
      await Promise.all([
        supabaseAdmin
          .from("workspace_members")
          .select("user_id, role, joined_at, invited_by")
          .eq("workspace_id", data.workspaceId)
          .order("joined_at", { ascending: true }),
        supabaseAdmin
          .from("workspace_invitations")
          .select("id, email, role, status, created_at, expires_at")
          .eq("workspace_id", data.workspaceId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);
    if (membersErr) throw new Error(membersErr.message);
    if (invitationsErr) throw new Error(invitationsErr.message);

    const userIds = [...new Set((members ?? []).map((member) => member.user_id))];
    const profilesByUser = new Map<string, {
      full_name: string | null;
      avatar_url: string | null;
      job_role: string | null;
      department: string | null;
    }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, avatar_url, job_role, department")
        .in("user_id", userIds);
      if (profilesErr) throw new Error(profilesErr.message);
      for (const profile of profiles ?? []) {
        profilesByUser.set(profile.user_id, profile);
      }
    }

    const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) throw new Error(authErr.message);
    const emailByUser = new Map(authUsers.users.map((user) => [user.id, user.email ?? null]));

    const progressByUser = new Map<string, { completed: number; lastActivityAt: string | null }>();
    if (userIds.length > 0) {
      const { data: progress, error: progressErr } = await supabaseAdmin
        .from("assess_progress")
        .select("user_id, status, updated_at")
        .eq("workspace_id", data.workspaceId)
        .in("user_id", userIds);
      if (progressErr) throw new Error(progressErr.message);
      for (const row of progress ?? []) {
        const current = progressByUser.get(row.user_id) ?? { completed: 0, lastActivityAt: null };
        if (row.status === "completed") current.completed += 1;
        if (!current.lastActivityAt || Date.parse(row.updated_at) > Date.parse(current.lastActivityAt)) {
          current.lastActivityAt = row.updated_at;
        }
        progressByUser.set(row.user_id, current);
      }
    }

    return {
      members: (members ?? []).map((member) => {
        const profile = profilesByUser.get(member.user_id);
        const progress = progressByUser.get(member.user_id);
        return {
          user_id: member.user_id,
          role: member.role as WorkspaceRole,
          joined_at: member.joined_at,
          invited_by: member.invited_by,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          job_role: profile?.job_role ?? null,
          department: profile?.department ?? null,
          email: emailByUser.get(member.user_id) ?? null,
          profileComplete: !!(profile?.full_name && profile?.job_role),
          assessCompleted: progress?.completed ?? 0,
          assessTotal: MODULES.length,
          lastActivityAt: progress?.lastActivityAt ?? null,
        };
      }),
      pendingInvitations: (invitations ?? []) as WorkspaceAdminInvitation[],
    };
  });

const InvitationActionInput = WorkspaceInput.extend({
  invitationId: z.string().uuid(),
});

export const revokeWorkspaceInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InvitationActionInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireWorkspaceAdmin({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
    });

    const { data: invitation, error: beforeErr } = await supabaseAdmin
      .from("workspace_invitations")
      .select("id, email, role")
      .eq("id", data.invitationId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message);
    if (!invitation) throw new Error("Invitation not found");

    const { error } = await supabaseAdmin
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId)
      .eq("workspace_id", data.workspaceId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    await writeWorkspaceAudit({
      workspaceId: data.workspaceId,
      actorId: context.userId,
      actionType: "workspace_invitation_revoked",
      entityType: "workspace_invitation",
      entityId: data.invitationId,
      entityLabel: invitation.email,
      metadata: { role: invitation.role },
    });
    return { ok: true };
  });

const RemoveMemberInput = WorkspaceInput.extend({
  userId: z.string().uuid(),
});

export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RemoveMemberInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireWorkspaceAdmin({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
    });

    if (data.userId === context.userId) {
      throw new Error("You cannot remove your own admin access.");
    }

    const { data: target, error: targetErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target) throw new Error("Workspace member not found");
    if (["owner", "admin"].includes(target.role)) {
      throw new Error("Owner and admin access is managed by House of Ichigo.");
    }

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await writeWorkspaceAudit({
      workspaceId: data.workspaceId,
      actorId: context.userId,
      actionType: "workspace_member_removed",
      entityType: "workspace_member",
      entityId: data.userId,
      metadata: { role: target.role },
    });
    return { ok: true };
  });

export type WorkspaceAdminBillingData = {
  plan: string;
  subscription: {
    planId: string;
    status: string;
    seatLimit: number | null;
    currentPeriodEnd: string | null;
  };
  seats: {
    used: number;
    limit: number | null;
  };
  billingEvents: Array<{
    id: string;
    eventType: string;
    createdAt: string;
  }>;
};

export const getWorkspaceAdminBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WorkspaceInput.parse(input))
  .handler(async ({ data, context }): Promise<WorkspaceAdminBillingData> => {
    await requireWorkspaceAdmin({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
    });

    const [{ data: workspace, error: wsErr }, members, { data: subscription, error: subErr }, { data: events, error: eventsErr }] =
      await Promise.all([
        supabaseAdmin.from("workspaces").select("plan").eq("id", data.workspaceId).maybeSingle(),
        countRows(
          supabaseAdmin
            .from("workspace_members")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", data.workspaceId),
        ),
        adminDb
          .from("workspace_subscriptions")
          .select("plan_id, status, seat_limit, current_period_end")
          .eq("workspace_id", data.workspaceId)
          .maybeSingle(),
        adminDb
          .from("billing_events")
          .select("id, event_type, created_at")
          .eq("workspace_id", data.workspaceId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) throw new Error("Workspace not found");
    if (subErr) throw new Error(subErr.message);
    if (eventsErr) throw new Error(eventsErr.message);

    const sub = subscription as
      | { plan_id: string; status: string; seat_limit: number | null; current_period_end: string | null }
      | null;

    return {
      plan: workspace.plan,
      subscription: {
        planId: sub?.plan_id ?? workspace.plan,
        status: sub?.status ?? "manual",
        seatLimit: sub?.seat_limit ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
      },
      seats: {
        used: members,
        limit: sub?.seat_limit ?? null,
      },
      billingEvents: ((events ?? []) as Array<{ id: string; event_type: string; created_at: string }>).map(
        (event) => ({
          id: event.id,
          eventType: event.event_type,
          createdAt: event.created_at,
        }),
      ),
    };
  });
