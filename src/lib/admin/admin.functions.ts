import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { HoiAdminRole } from "@/hooks/useHoiAdmin";

const adminDb = supabaseAdmin as any;

const ADMIN_ROLES: HoiAdminRole[] = [
  "owner",
  "admin",
  "content_editor",
  "support",
  "billing_admin",
  "read_only",
];

type AdminUserRow = {
  user_id: string;
  role: HoiAdminRole;
  status: "active" | "suspended";
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_role: string | null;
  department: string | null;
  created_at: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  updated_at: string;
  worked_example: string | null;
  onboarding_dismissed_at: string | null;
  workspace_profile: Json | null;
  use_case_profile: Json | null;
};

async function getAdminAccess(userId: string) {
  const { data, error } = await adminDb
    .from("hoi_admin_users")
    .select("role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { role: HoiAdminRole; status: string } | null;
}

async function requireHoiAdmin(userId: string, roles: HoiAdminRole[] = ADMIN_ROLES) {
  const access = await getAdminAccess(userId);
  if (!access || !roles.includes(access.role)) {
    throw new Error("House of Ichigo admin access required");
  }
  return access;
}

function firstError(errors: Array<{ message?: string } | null | undefined>) {
  return errors.find((e) => e?.message)?.message;
}

const AdminNoteEntity = z.enum(["user", "workspace", "library_item", "billing", "support"]);
const AdminNoteStatus = z.enum(["open", "reviewed", "closed"]);

async function writeAdminAudit(input: {
  actorId: string;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await adminDb.from("hoi_admin_audit_log").insert({
    actor_id: input.actorId,
    action_type: input.actionType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    entity_label: input.entityLabel ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

type AdminNote = {
  id: string;
  entity_type: "user" | "workspace" | "library_item" | "billing" | "support";
  entity_id: string;
  note: string;
  status: "open" | "reviewed" | "closed";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type AdminDashboardData = {
  counts: {
    workspaces: number;
    profiles: number;
    libraryItems: number;
    contentDrafts: number;
    pendingInvites: number;
    pendingApprovals: number;
    openGovernanceFlags: number;
    paidPlanWorkspaces: number;
  };
  recentWorkspaces: WorkspaceRow[];
  contentStatus: Array<{ label: string; count: number }>;
  systemHealth: Array<{ label: string; status: "configured" | "missing"; detail: string }>;
};

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboardData> => {
    await requireHoiAdmin(context.userId);

    const [
      workspaces,
      profiles,
      libraryItems,
      drafts,
      pendingInvites,
      pendingApprovals,
      openFlags,
      paidWorkspaces,
      recentWorkspaces,
      libraryRows,
    ] = await Promise.all([
      supabaseAdmin.from("workspaces").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("library_items").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("library_items")
        .select("id", { count: "exact", head: true })
        .in("editorial_status", ["draft", "in_review"]),
      supabaseAdmin
        .from("workspace_invitations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("use_case_approvals")
        .select("id", { count: "exact", head: true })
        .eq("decision", "pending"),
      supabaseAdmin
        .from("governance_flags")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]),
      supabaseAdmin
        .from("workspaces")
        .select("id", { count: "exact", head: true })
        .neq("plan", "free"),
      supabaseAdmin
        .from("workspaces")
        .select("id, name, slug, plan, created_at, updated_at, worked_example, onboarding_dismissed_at, workspace_profile, use_case_profile")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin.from("library_items").select("editorial_status"),
    ]);

    const error = firstError([
      workspaces.error,
      profiles.error,
      libraryItems.error,
      drafts.error,
      pendingInvites.error,
      pendingApprovals.error,
      openFlags.error,
      paidWorkspaces.error,
      recentWorkspaces.error,
      libraryRows.error,
    ]);
    if (error) throw new Error(error);

    const statusCounts = new Map<string, number>();
    for (const row of libraryRows.data ?? []) {
      const status = (row as { editorial_status?: string }).editorial_status ?? "draft";
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    return {
      counts: {
        workspaces: workspaces.count ?? 0,
        profiles: profiles.count ?? 0,
        libraryItems: libraryItems.count ?? 0,
        contentDrafts: drafts.count ?? 0,
        pendingInvites: pendingInvites.count ?? 0,
        pendingApprovals: pendingApprovals.count ?? 0,
        openGovernanceFlags: openFlags.count ?? 0,
        paidPlanWorkspaces: paidWorkspaces.count ?? 0,
      },
      recentWorkspaces: (recentWorkspaces.data ?? []) as WorkspaceRow[],
      contentStatus: ["draft", "in_review", "published", "archived"].map((status) => ({
        label: status,
        count: statusCounts.get(status) ?? 0,
      })),
      systemHealth: [
        {
          label: "Supabase service role",
          status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "missing",
          detail: "Required for internal admin server functions.",
        },
        {
          label: "Resend API key",
          status: process.env.RESEND_API_KEY ? "configured" : "missing",
          detail: "Required for invite and notification emails.",
        },
        {
          label: "Stripe secret key",
          status: process.env.STRIPE_SECRET_KEY ? "configured" : "missing",
          detail: "Future billing integration placeholder.",
        },
      ],
    };
  });

export type AdminUserListItem = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  job_role: string | null;
  department: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  workspace_count: number;
  memberships: Array<{ workspace_id: string; workspace_name: string; role: string }>;
};

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserListItem[]> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support", "read_only"]);

    const [{ data: authUsers, error: authErr }, { data: profiles, error: profilesErr }, { data: members, error: membersErr }, { data: workspaces, error: workspacesErr }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("profiles").select("user_id, full_name, avatar_url, job_role, department, created_at"),
        supabaseAdmin.from("workspace_members").select("user_id, workspace_id, role"),
        supabaseAdmin.from("workspaces").select("id, name"),
      ]);

    const error = authErr?.message ?? firstError([profilesErr, membersErr, workspacesErr]);
    if (error) throw new Error(error);

    const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id, p as ProfileRow]));
    const workspaceById = new Map((workspaces ?? []).map((w) => [w.id, w.name]));
    const membershipsByUser = new Map<string, AdminUserListItem["memberships"]>();

    for (const member of members ?? []) {
      const list = membershipsByUser.get(member.user_id) ?? [];
      list.push({
        workspace_id: member.workspace_id,
        workspace_name: workspaceById.get(member.workspace_id) ?? "Unknown workspace",
        role: member.role,
      });
      membershipsByUser.set(member.user_id, list);
    }

    return authUsers.users.map((u) => {
      const profile = profileByUser.get(u.id);
      const memberships = membershipsByUser.get(u.id) ?? [];
      return {
        user_id: u.id,
        email: u.email ?? null,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        job_role: profile?.job_role ?? null,
        department: profile?.department ?? null,
        created_at: u.created_at ?? profile?.created_at ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        workspace_count: memberships.length,
        memberships,
      };
    });
  });

export type AdminWorkspaceListItem = WorkspaceRow & {
  member_count: number;
  use_case_count: number;
  open_governance_flags: number;
  pending_invites: number;
  onboarding_state: "complete" | "incomplete";
};

export const getAdminWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminWorkspaceListItem[]> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support", "billing_admin", "read_only"]);

    const [{ data: workspaces, error: wsErr }, { data: members, error: membersErr }, { data: useCases, error: useCasesErr }, { data: flags, error: flagsErr }, { data: invites, error: invitesErr }] =
      await Promise.all([
        supabaseAdmin
          .from("workspaces")
          .select("id, name, slug, plan, created_at, updated_at, worked_example, onboarding_dismissed_at, workspace_profile, use_case_profile")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("workspace_members").select("workspace_id"),
        supabaseAdmin.from("use_cases").select("workspace_id"),
        supabaseAdmin.from("governance_flags").select("workspace_id, status").in("status", ["open", "in_progress"]),
        supabaseAdmin.from("workspace_invitations").select("workspace_id, status").eq("status", "pending"),
      ]);

    const error = firstError([wsErr, membersErr, useCasesErr, flagsErr, invitesErr]);
    if (error) throw new Error(error);

    const countByWorkspace = (rows: Array<{ workspace_id: string }>) => {
      const out = new Map<string, number>();
      for (const row of rows) out.set(row.workspace_id, (out.get(row.workspace_id) ?? 0) + 1);
      return out;
    };

    const memberCounts = countByWorkspace(members ?? []);
    const useCaseCounts = countByWorkspace(useCases ?? []);
    const flagCounts = countByWorkspace(flags ?? []);
    const inviteCounts = countByWorkspace(invites ?? []);

    return ((workspaces ?? []) as WorkspaceRow[]).map((ws) => ({
      ...ws,
      member_count: memberCounts.get(ws.id) ?? 0,
      use_case_count: useCaseCounts.get(ws.id) ?? 0,
      open_governance_flags: flagCounts.get(ws.id) ?? 0,
      pending_invites: inviteCounts.get(ws.id) ?? 0,
      onboarding_state: ws.workspace_profile && ws.use_case_profile && ws.worked_example ? "complete" : "incomplete",
    }));
  });

export type AdminBillingData = {
  plans: Array<{ id: string; name: string; active: boolean; seat_limit: number | null; monthly_price_cents: number | null; stripe_price_id: string | null }>;
  subscriptions: Array<{ workspace_id: string; workspace_name: string; plan_id: string; status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; current_period_end: string | null }>;
};

export const getAdminBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBillingData> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "billing_admin", "read_only"]);

    const [{ data: plans, error: plansErr }, { data: subs, error: subsErr }, { data: workspaces, error: wsErr }] =
      await Promise.all([
        adminDb.from("plans").select("id, name, active, seat_limit, monthly_price_cents, stripe_price_id").order("id"),
        adminDb
          .from("workspace_subscriptions")
          .select("workspace_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_end"),
        supabaseAdmin.from("workspaces").select("id, name, plan"),
      ]);
    const error = firstError([plansErr, subsErr, wsErr]);
    if (error) throw new Error(error);

    const wsById = new Map((workspaces ?? []).map((w) => [w.id, w]));
    const explicitSubs = ((subs ?? []) as AdminBillingData["subscriptions"]).map((s) => ({
      workspace_id: s.workspace_id,
      workspace_name: wsById.get(s.workspace_id)?.name ?? "Unknown workspace",
      plan_id: s.plan_id,
      status: s.status,
      stripe_customer_id: s.stripe_customer_id,
      stripe_subscription_id: s.stripe_subscription_id,
      current_period_end: s.current_period_end,
    }));

    const subbed = new Set(explicitSubs.map((s) => s.workspace_id));
    const manualSubs = (workspaces ?? [])
      .filter((ws) => !subbed.has(ws.id))
      .map((ws) => ({
        workspace_id: ws.id,
        workspace_name: ws.name,
        plan_id: ws.plan,
        status: "manual",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_end: null,
      }));

    return {
      plans: (plans ?? []) as AdminBillingData["plans"],
      subscriptions: [...explicitSubs, ...manualSubs],
    };
  });

export type AdminSupportItem = {
  id: string;
  kind: "pending_invite" | "pending_approval" | "open_governance_flag" | "incomplete_onboarding";
  title: string;
  detail: string;
  workspace_id: string | null;
  workspace_name: string | null;
  created_at: string;
};

export const getAdminSupport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSupportItem[]> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support", "read_only"]);

    const [{ data: workspaces }, { data: invites }, { data: approvals }, { data: flags }, { data: closedNotes }] = await Promise.all([
      supabaseAdmin.from("workspaces").select("id, name, workspace_profile, use_case_profile, worked_example, created_at"),
      supabaseAdmin
        .from("workspace_invitations")
        .select("id, workspace_id, email, created_at, expires_at")
        .eq("status", "pending"),
      supabaseAdmin
        .from("use_case_approvals")
        .select("id, use_case_id, submitted_at")
        .eq("decision", "pending"),
      supabaseAdmin
        .from("governance_flags")
        .select("id, workspace_id, rule_code, severity, status, created_at")
        .in("status", ["open", "in_progress"]),
      adminDb
        .from("hoi_admin_notes")
        .select("entity_id")
        .eq("entity_type", "support")
        .in("status", ["reviewed", "closed"]),
    ]);

    const wsById = new Map((workspaces ?? []).map((w) => [w.id, w.name]));
    const closedSupportSignals = new Set((closedNotes ?? []).map((n: { entity_id: string }) => n.entity_id));
    const approvalUseCaseIds = [...new Set((approvals ?? []).map((a) => a.use_case_id).filter(Boolean))];
    const useCaseById = new Map<string, { id: string; name: string; workspace_id: string }>();
    if (approvalUseCaseIds.length > 0) {
      const { data: useCases, error: ucErr } = await supabaseAdmin
        .from("use_cases")
        .select("id, name, workspace_id")
        .in("id", approvalUseCaseIds);
      if (ucErr) throw new Error(ucErr.message);
      for (const useCase of useCases ?? []) {
        useCaseById.set(useCase.id, useCase as { id: string; name: string; workspace_id: string });
      }
    }
    const items: AdminSupportItem[] = [];

    for (const ws of workspaces ?? []) {
      const supportId = `onboarding:${ws.id}`;
      if (closedSupportSignals.has(supportId)) continue;
      if (!ws.workspace_profile || !ws.use_case_profile || !ws.worked_example) {
        items.push({
          id: supportId,
          kind: "incomplete_onboarding",
          title: "Workspace onboarding incomplete",
          detail: "Company profile, worked example, or use-case profile is missing.",
          workspace_id: ws.id,
          workspace_name: ws.name,
          created_at: ws.created_at,
        });
      }
    }

    for (const invite of invites ?? []) {
      const supportId = `invite:${invite.id}`;
      if (closedSupportSignals.has(supportId)) continue;
      items.push({
        id: supportId,
        kind: "pending_invite",
        title: "Pending invitation",
        detail: invite.email,
        workspace_id: invite.workspace_id,
        workspace_name: wsById.get(invite.workspace_id) ?? null,
        created_at: invite.created_at,
      });
    }

    for (const approval of approvals ?? []) {
      const supportId = `approval:${approval.id}`;
      if (closedSupportSignals.has(supportId)) continue;
      const useCase = useCaseById.get(approval.use_case_id);
      items.push({
        id: supportId,
        kind: "pending_approval",
        title: "Build approval waiting",
        detail: useCase ? `${useCase.name} (${approval.use_case_id})` : `Use case ${approval.use_case_id}`,
        workspace_id: useCase?.workspace_id ?? null,
        workspace_name: useCase ? wsById.get(useCase.workspace_id) ?? null : null,
        created_at: approval.submitted_at ?? new Date().toISOString(),
      });
    }

    for (const flag of flags ?? []) {
      const supportId = `governance:${flag.id}`;
      if (closedSupportSignals.has(supportId)) continue;
      items.push({
        id: supportId,
        kind: "open_governance_flag",
        title: `${flag.severity} governance flag`,
        detail: flag.rule_code,
        workspace_id: flag.workspace_id,
        workspace_name: wsById.get(flag.workspace_id) ?? null,
        created_at: flag.created_at,
      });
    }

    return items.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 100);
  });

export type AdminAuditEntry = {
  id: string;
  actor_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: Json | null;
  created_at: string;
};

export const getAdminAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAuditEntry[]> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support", "read_only"]);
    const { data, error } = await adminDb
      .from("hoi_admin_audit_log")
      .select("id, actor_id, action_type, entity_type, entity_id, entity_label, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminAuditEntry[];
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireHoiAdmin(context.userId);
    const { data, error } = await adminDb
      .from("hoi_admin_users")
      .select("user_id, role, status, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminUserRow[];
  });

const NotesInput = z.object({
  entityType: AdminNoteEntity,
  entityId: z.string().min(1),
});

export const getAdminNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => NotesInput.parse(input))
  .handler(async ({ data, context }): Promise<AdminNote[]> => {
    await requireHoiAdmin(context.userId);
    const { data: notes, error } = await adminDb
      .from("hoi_admin_notes")
      .select("id, entity_type, entity_id, note, status, created_by, created_at, updated_at, reviewed_at, reviewed_by")
      .eq("entity_type", data.entityType)
      .eq("entity_id", data.entityId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (notes ?? []) as AdminNote[];
  });

const CreateNoteInput = NotesInput.extend({
  note: z.string().trim().min(2).max(4000),
  status: AdminNoteStatus.optional(),
});

export const createAdminNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateNoteInput.parse(input))
  .handler(async ({ data, context }): Promise<AdminNote> => {
    await requireHoiAdmin(context.userId);
    const row = {
      entity_type: data.entityType,
      entity_id: data.entityId,
      note: data.note,
      status: data.status ?? "open",
      created_by: context.userId,
      reviewed_at: data.status && data.status !== "open" ? new Date().toISOString() : null,
      reviewed_by: data.status && data.status !== "open" ? context.userId : null,
    };
    const { data: note, error } = await adminDb
      .from("hoi_admin_notes")
      .insert(row)
      .select("id, entity_type, entity_id, note, status, created_by, created_at, updated_at, reviewed_at, reviewed_by")
      .single();
    if (error) throw new Error(error.message);
    await writeAdminAudit({
      actorId: context.userId,
      actionType: "admin_note_created",
      entityType: data.entityType,
      entityId: data.entityId,
      afterState: row,
    });
    return note as AdminNote;
  });

const UpdateNoteInput = z.object({
  noteId: z.string().uuid(),
  status: AdminNoteStatus,
});

export const updateAdminNoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateNoteInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireHoiAdmin(context.userId);
    const { data: before, error: beforeErr } = await adminDb
      .from("hoi_admin_notes")
      .select("id, entity_type, entity_id, note, status")
      .eq("id", data.noteId)
      .maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message);
    if (!before) throw new Error("Admin note not found");

    const patch = {
      status: data.status,
      reviewed_at: data.status === "open" ? null : new Date().toISOString(),
      reviewed_by: data.status === "open" ? null : context.userId,
    };
    const { error } = await adminDb.from("hoi_admin_notes").update(patch).eq("id", data.noteId);
    if (error) throw new Error(error.message);
    await writeAdminAudit({
      actorId: context.userId,
      actionType: "admin_note_status_updated",
      entityType: before.entity_type,
      entityId: before.entity_id,
      beforeState: { status: before.status },
      afterState: { status: data.status },
    });
    return { ok: true };
  });

const ResolveSupportInput = z.object({
  supportId: z.string().min(1),
  note: z.string().trim().min(2).max(4000),
});

export const resolveAdminSupportSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ResolveSupportInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support"]);
    const row = {
      entity_type: "support",
      entity_id: data.supportId,
      note: data.note,
      status: "closed",
      created_by: context.userId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    };
    const { error } = await adminDb.from("hoi_admin_notes").insert(row);
    if (error) throw new Error(error.message);
    await writeAdminAudit({
      actorId: context.userId,
      actionType: "support_signal_resolved",
      entityType: "support",
      entityId: data.supportId,
      afterState: row,
    });
    return { ok: true };
  });

const WorkspaceUpdateInput = z.object({
  workspaceId: z.string().uuid(),
  plan: z.enum(["free", "team", "enterprise"]).optional(),
});

export const updateAdminWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WorkspaceUpdateInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "billing_admin", "support"]);
    const { data: before, error: beforeErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, plan")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message);
    if (!before) throw new Error("Workspace not found");

    const patch: { plan?: "free" | "team" | "enterprise" } = {};
    if (data.plan) patch.plan = data.plan;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("workspaces").update(patch).eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await writeAdminAudit({
      actorId: context.userId,
      actionType: "workspace_admin_updated",
      entityType: "workspace",
      entityId: data.workspaceId,
      entityLabel: before.name,
      beforeState: { plan: before.plan },
      afterState: patch,
    });
    return { ok: true };
  });

export type AdminWorkspaceMemberRow = {
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  joined_at: string;
  invited_by: string | null;
  full_name: string | null;
  email: string | null;
};

const WorkspaceMembersInput = z.object({
  workspaceId: z.string().uuid(),
});

export const getAdminWorkspaceMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WorkspaceMembersInput.parse(input))
  .handler(async ({ data, context }): Promise<AdminWorkspaceMemberRow[]> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support", "read_only"]);

    const { data: members, error } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id, role, joined_at, invited_by")
      .eq("workspace_id", data.workspaceId)
      .order("joined_at", { ascending: true });
    if (error) throw new Error(error.message);

    const userIds = [...new Set((members ?? []).map((member) => member.user_id))];
    const profileByUser = new Map<string, { full_name: string | null }>();
    if (userIds.length) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (profileErr) throw new Error(profileErr.message);
      for (const profile of profiles ?? []) profileByUser.set(profile.user_id, profile);
    }

    const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) throw new Error(authErr.message);
    const emailByUser = new Map(authUsers.users.map((user) => [user.id, user.email ?? null]));

    return (members ?? []).map((member) => ({
      user_id: member.user_id,
      role: member.role as AdminWorkspaceMemberRow["role"],
      joined_at: member.joined_at,
      invited_by: member.invited_by,
      full_name: profileByUser.get(member.user_id)?.full_name ?? null,
      email: emailByUser.get(member.user_id) ?? null,
    }));
  });

const WorkspaceMemberRoleInput = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

export const updateAdminWorkspaceMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WorkspaceMemberRoleInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireHoiAdmin(context.userId, ["owner", "admin"]);

    const { data: workspace, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!workspace) throw new Error("Workspace not found");

    const { data: before, error: beforeErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message);
    if (!before) throw new Error("Workspace member not found");
    if (before.role === data.role) return { ok: true };

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({ role: data.role })
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await writeAdminAudit({
      actorId: context.userId,
      actionType: "workspace_member_role_updated",
      entityType: "workspace",
      entityId: data.workspaceId,
      entityLabel: workspace.name,
      beforeState: { user_id: data.userId, role: before.role },
      afterState: { user_id: data.userId, role: data.role },
    });
    return { ok: true };
  });

const SubscriptionInput = z.object({
  workspaceId: z.string().uuid(),
  planId: z.string().min(1),
  status: z.enum(["manual", "trialing", "active", "past_due", "canceled", "unpaid", "incomplete"]),
  seatLimit: z.number().int().positive().nullable().optional(),
  stripeCustomerId: z.string().trim().nullable().optional(),
  stripeSubscriptionId: z.string().trim().nullable().optional(),
  priceId: z.string().trim().nullable().optional(),
  currentPeriodEnd: z.string().trim().nullable().optional(),
});

export const upsertAdminWorkspaceSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubscriptionInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "billing_admin"]);
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, plan")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!ws) throw new Error("Workspace not found");

    const { data: before } = await adminDb
      .from("workspace_subscriptions")
      .select("workspace_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, seat_limit, price_id")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();

    const subscription = {
      workspace_id: data.workspaceId,
      plan_id: data.planId,
      status: data.status,
      stripe_customer_id: data.stripeCustomerId || null,
      stripe_subscription_id: data.stripeSubscriptionId || null,
      current_period_end: data.currentPeriodEnd || null,
      seat_limit: data.seatLimit ?? null,
      price_id: data.priceId || null,
    };
    const { error } = await adminDb
      .from("workspace_subscriptions")
      .upsert(subscription, { onConflict: "workspace_id" });
    if (error) throw new Error(error.message);

    if (["free", "team", "enterprise"].includes(data.planId)) {
      const { error: planErr } = await supabaseAdmin
        .from("workspaces")
        .update({ plan: data.planId })
        .eq("id", data.workspaceId);
      if (planErr) throw new Error(planErr.message);
    }

    await writeAdminAudit({
      actorId: context.userId,
      actionType: "workspace_subscription_upserted",
      entityType: "billing",
      entityId: data.workspaceId,
      entityLabel: ws.name,
      beforeState: before ?? { plan: ws.plan },
      afterState: subscription,
    });
    return { ok: true };
  });

const AdminRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "content_editor", "support", "billing_admin", "read_only"]),
  status: z.enum(["active", "suspended"]),
});

export const upsertHoiAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AdminRoleInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireHoiAdmin(context.userId, ["owner", "admin"]);
    const { data: before } = await adminDb
      .from("hoi_admin_users")
      .select("user_id, role, status")
      .eq("user_id", data.userId)
      .maybeSingle();
    const row = {
      user_id: data.userId,
      role: data.role,
      status: data.status,
      created_by: context.userId,
    };
    const { error } = await adminDb.from("hoi_admin_users").upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await writeAdminAudit({
      actorId: context.userId,
      actionType: "hoi_admin_user_upserted",
      entityType: "user",
      entityId: data.userId,
      beforeState: before ?? null,
      afterState: row,
    });
    return { ok: true };
  });
