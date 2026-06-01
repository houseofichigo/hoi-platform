import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { AdminNotesPanel } from "@/components/admin/AdminNotesPanel";
import { useHoiAdmin } from "@/hooks/useHoiAdmin";
import {
  getAdminWorkspaceMembers,
  getAdminWorkspaces,
  updateAdminWorkspaceMemberRole,
  updateAdminWorkspace,
  type AdminWorkspaceMemberRow,
  type AdminWorkspaceListItem,
} from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/workspaces")({
  component: AdminWorkspaces,
});

function AdminWorkspaces() {
  const [search, setSearch] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const getWorkspaces = useServerFn(getAdminWorkspaces);
  const { data = [], isLoading, error } = useQuery<AdminWorkspaceListItem[]>({
    queryKey: ["admin", "workspaces"],
    queryFn: () => getWorkspaces(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((ws) => [ws.name, ws.slug, ws.plan].join(" ").toLowerCase().includes(q));
  }, [data, search]);
  const selected = filtered.find((ws) => ws.id === selectedWorkspaceId) ?? null;

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · CUSTOMERS"
        title="Workspace directory."
        lead="Customer workspace overview for support, customer success, and billing readiness."
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search workspaces..."
        className="mb-4 w-full rounded-md border border-chalk bg-white px-3 py-2 text-[14px] outline-none focus:border-terracotta"
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading workspaces...</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((ws) => (
            <article key={ws.id} className="rounded-md border border-chalk bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className="text-[16px] font-semibold text-navy hover:text-terracotta"
                  >
                    {ws.name}
                  </button>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
                    {ws.slug} · {ws.plan}
                  </p>
                </div>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px]",
                    ws.onboarding_state === "complete"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700",
                  ].join(" ")}
                >
                  {ws.onboarding_state}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <MiniStat label="Members" value={ws.member_count} />
                <MiniStat label="Use cases" value={ws.use_case_count} />
                <MiniStat label="Open flags" value={ws.open_governance_flags} />
                <MiniStat label="Pending invites" value={ws.pending_invites} />
                <MiniStat label="Created" value={new Date(ws.created_at).toLocaleDateString()} />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className="rounded-full border border-chalk px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
                >
                  Open workspace
                </button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-md border border-chalk bg-white p-8 text-center text-[14px] text-slate">
              No workspaces match the search.
            </div>
          )}
        </div>
      )}

      {selected && <WorkspaceDrawer workspace={selected} onClose={() => setSelectedWorkspaceId(null)} />}
    </AdminShell>
  );
}

function WorkspaceDrawer({
  workspace,
  onClose,
}: {
  workspace: AdminWorkspaceListItem;
  onClose: () => void;
}) {
  const admin = useHoiAdmin();
  const qc = useQueryClient();
  const updateWorkspace = useServerFn(updateAdminWorkspace);
  const [plan, setPlan] = useState<"free" | "team" | "enterprise">(
    (["free", "team", "enterprise"].includes(workspace.plan) ? workspace.plan : "free") as
      | "free"
      | "team"
      | "enterprise",
  );
  const savePlan = useMutation({
    mutationFn: () => updateWorkspace({ data: { workspaceId: workspace.id, plan } }),
    onSuccess: () => {
      toast.success("Workspace updated");
      qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const canEditPlan = admin.canManageBilling || admin.role === "owner" || admin.role === "admin";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/35">
      <aside className="h-full w-full max-w-[680px] overflow-y-auto bg-paper p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">CUSTOMER WORKSPACE</p>
            <h2 className="mt-1 text-[24px] font-semibold text-navy">{workspace.name}</h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
              {workspace.slug} · {workspace.id}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-chalk px-3 py-1 text-[12px]">
            Close
          </button>
        </div>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniStat label="Members" value={workspace.member_count} />
          <MiniStat label="Use cases" value={workspace.use_case_count} />
          <MiniStat label="Open flags" value={workspace.open_governance_flags} />
          <MiniStat label="Pending invites" value={workspace.pending_invites} />
          <MiniStat label="Onboarding" value={workspace.onboarding_state} />
          <MiniStat label="Created" value={new Date(workspace.created_at).toLocaleDateString()} />
        </section>

        <section className="mt-5 rounded-md border border-chalk bg-white p-4">
          <p className="eyebrow-muted">Plan and access</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[12px] text-slate">Workspace plan</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as "free" | "team" | "enterprise")}
                disabled={!canEditPlan}
                className="input mt-1 w-[180px]"
              >
                <option value="free">Free</option>
                <option value="team">Team</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <button
              type="button"
              disabled={savePlan.isPending || plan === workspace.plan || !canEditPlan}
              onClick={() => savePlan.mutate()}
              className="btn-ichigo btn-ichigo-primary text-[12px] disabled:opacity-50"
            >
              {savePlan.isPending ? "Saving..." : "Save plan"}
            </button>
          </div>
          <p className="mt-3 text-[12px] text-slate">
            Billing remains manual until Stripe is connected; this updates the platform display plan and records an audit event.
          </p>
        </section>

        <section className="mt-5 rounded-md border border-chalk bg-white p-4">
          <p className="eyebrow-muted">Profile completeness</p>
          <div className="mt-3 grid gap-2 text-[13px] text-navy">
            <ProfileSignal label="Company profile" complete={!!workspace.workspace_profile} />
            <ProfileSignal label="Use-case profile" complete={!!workspace.use_case_profile} />
            <ProfileSignal label="Worked example" complete={!!workspace.worked_example} />
          </div>
        </section>

        <WorkspaceMembersAdminPanel workspaceId={workspace.id} canManageRoles={admin.role === "owner" || admin.role === "admin"} />

        <div className="mt-5">
          <AdminNotesPanel entityType="workspace" entityId={workspace.id} />
        </div>
      </aside>
    </div>
  );
}

function WorkspaceMembersAdminPanel({
  workspaceId,
  canManageRoles,
}: {
  workspaceId: string;
  canManageRoles: boolean;
}) {
  const qc = useQueryClient();
  const getMembers = useServerFn(getAdminWorkspaceMembers);
  const updateRole = useServerFn(updateAdminWorkspaceMemberRole);
  const { data = [], isLoading, error } = useQuery<AdminWorkspaceMemberRow[]>({
    queryKey: ["admin", "workspace-members", workspaceId],
    queryFn: () => getMembers({ data: { workspaceId } }),
  });

  const mutation = useMutation({
    mutationFn: (input: { userId: string; role: AdminWorkspaceMemberRow["role"] }) =>
      updateRole({ data: { workspaceId, userId: input.userId, role: input.role } }),
    onSuccess: () => {
      toast.success("Workspace role updated");
      qc.invalidateQueries({ queryKey: ["admin", "workspace-members", workspaceId] });
      qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="mt-5 rounded-md border border-chalk bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow-muted">Workspace admins and members</p>
          <p className="mt-2 text-[12px] text-slate">
            House of Ichigo controls owner/admin promotion. Client admins can invite members and viewers only.
          </p>
        </div>
        {!canManageRoles && (
          <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] text-slate">Read-only</span>
        )}
      </div>

      {isLoading ? (
        <p className="mt-4 text-[13px] text-slate">Loading members...</p>
      ) : error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-chalk">
          {data.map((member) => (
            <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-navy">{member.full_name || member.email || "Unnamed member"}</p>
                <p className="truncate text-[12px] text-slate">{member.email || member.user_id}</p>
              </div>
              <select
                value={member.role}
                disabled={!canManageRoles || mutation.isPending}
                onChange={(e) =>
                  mutation.mutate({
                    userId: member.user_id,
                    role: e.target.value as AdminWorkspaceMemberRow["role"],
                  })
                }
                className="input w-[150px] text-[12px]"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          ))}
          {data.length === 0 && <p className="py-4 text-[13px] text-slate">No members found.</p>}
        </div>
      )}
    </section>
  );
}

function ProfileSignal({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-mist px-3 py-2">
      <span>{label}</span>
      <span className={complete ? "text-emerald-700" : "text-amber-700"}>
        {complete ? "Complete" : "Missing"}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-mist p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{label}</p>
      <p className="mt-1 text-[15px] font-medium text-navy">{value}</p>
    </div>
  );
}
