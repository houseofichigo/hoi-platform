import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  workspace_profile: unknown;
  use_case_profile: unknown;
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
    const explicitSubs = (subs ?? []).map((s) => ({
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

    const [{ data: workspaces }, { data: invites }, { data: approvals }, { data: flags }] = await Promise.all([
      supabaseAdmin.from("workspaces").select("id, name, workspace_profile, use_case_profile, worked_example, created_at"),
      supabaseAdmin
        .from("workspace_invitations")
        .select("id, workspace_id, email, created_at, expires_at")
        .eq("status", "pending"),
      supabaseAdmin
        .from("use_case_approvals")
        .select("id, workspace_id, use_case_id, submitted_at")
        .eq("decision", "pending"),
      supabaseAdmin
        .from("governance_flags")
        .select("id, workspace_id, rule_code, severity, status, created_at")
        .in("status", ["open", "in_progress"]),
    ]);

    const wsById = new Map((workspaces ?? []).map((w) => [w.id, w.name]));
    const items: AdminSupportItem[] = [];

    for (const ws of workspaces ?? []) {
      if (!ws.workspace_profile || !ws.use_case_profile || !ws.worked_example) {
        items.push({
          id: `onboarding:${ws.id}`,
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
      items.push({
        id: invite.id,
        kind: "pending_invite",
        title: "Pending invitation",
        detail: invite.email,
        workspace_id: invite.workspace_id,
        workspace_name: wsById.get(invite.workspace_id) ?? null,
        created_at: invite.created_at,
      });
    }

    for (const approval of approvals ?? []) {
      items.push({
        id: approval.id,
        kind: "pending_approval",
        title: "Build approval waiting",
        detail: `Use case ${approval.use_case_id}`,
        workspace_id: approval.workspace_id,
        workspace_name: wsById.get(approval.workspace_id) ?? null,
        created_at: approval.submitted_at,
      });
    }

    for (const flag of flags ?? []) {
      items.push({
        id: flag.id,
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

export const getAdminAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireHoiAdmin(context.userId, ["owner", "admin", "support", "read_only"]);
    const { data, error } = await adminDb
      .from("hoi_admin_audit_log")
      .select("id, actor_id, action_type, entity_type, entity_id, entity_label, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
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
