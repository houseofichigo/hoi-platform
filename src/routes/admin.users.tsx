import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { AdminNotesPanel } from "@/components/admin/AdminNotesPanel";
import { getAdminUsers, type AdminUserListItem } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const getUsers = useServerFn(getAdminUsers);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => getUsers(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((u) =>
      [u.email ?? "", u.full_name ?? "", u.job_role ?? "", u.department ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);
  const selected = filtered.find((u) => u.user_id === selectedUserId) ?? null;

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · USERS"
        title="User directory."
        lead="Search House of Ichigo platform users and see their workspace memberships. Support actions are read-only in this v1 surface."
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users…"
        className="mb-4 w-full rounded-md border border-chalk bg-white px-3 py-2 text-[14px] outline-none focus:border-terracotta"
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading users…</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-chalk bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-mist text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
              <tr>
                <th className="px-3 py-3 font-normal">User</th>
                <th className="px-3 py-3 font-normal">Role / department</th>
                <th className="px-3 py-3 font-normal">Workspaces</th>
                <th className="px-3 py-3 font-normal">Last sign-in</th>
                <th className="px-3 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-chalk align-top text-navy">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(u.user_id)}
                      className="font-medium hover:text-terracotta"
                    >
                      {u.full_name || "Unnamed user"}
                    </button>
                    <p className="text-[12px] text-slate">{u.email || "No email"}</p>
                  </td>
                  <td className="px-3 py-3 text-slate">
                    {[u.job_role, u.department].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-[12px] text-slate">{u.workspace_count} workspace(s)</p>
                    <p className="mt-1 max-w-[360px] text-[12px] text-graphite">
                      {u.memberships.map((m) => `${m.workspace_name} (${m.role})`).join(", ") || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(u.user_id)}
                      className="rounded-full border border-chalk px-2.5 py-1 text-[11px] text-navy hover:bg-mist"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate">
                    No users match the search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <UserDrawer user={selected} onClose={() => setSelectedUserId(null)} />}
    </AdminShell>
  );
}

function UserDrawer({
  user,
  onClose,
}: {
  user: AdminUserListItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/35">
      <aside className="h-full w-full max-w-[620px] overflow-y-auto bg-paper p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">USER DETAIL</p>
            <h2 className="mt-1 text-[24px] font-semibold text-navy">
              {user.full_name || "Unnamed user"}
            </h2>
            <p className="text-[13px] text-slate">{user.email || "No email"}</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-chalk px-3 py-1 text-[12px]">
            Close
          </button>
        </div>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <MiniFact label="Created" value={shortDate(user.created_at)} />
          <MiniFact label="Last sign-in" value={user.last_sign_in_at ? shortDate(user.last_sign_in_at) : "Never"} />
          <MiniFact label="Workspaces" value={user.workspace_count} />
          <MiniFact label="Profile" value={[user.job_role, user.department].filter(Boolean).join(" · ") || "Missing"} />
        </section>

        <section className="mt-5 rounded-md border border-chalk bg-white p-4">
          <p className="eyebrow-muted">Workspace memberships</p>
          <div className="mt-3 divide-y divide-chalk">
            {user.memberships.length === 0 ? (
              <p className="py-3 text-[13px] text-slate">No workspace memberships.</p>
            ) : (
              user.memberships.map((m) => (
                <div key={`${m.workspace_id}:${m.role}`} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-[13px] font-medium text-navy">{m.workspace_name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{m.workspace_id}</p>
                  </div>
                  <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-slate">{m.role}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="mt-5">
          <AdminNotesPanel entityType="user" entityId={user.user_id} />
        </div>
      </aside>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-chalk bg-white p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-navy">{value}</p>
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString();
}
