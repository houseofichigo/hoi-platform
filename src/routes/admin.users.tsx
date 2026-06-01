import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminUsers } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [search, setSearch] = useState("");
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-chalk align-top text-navy">
                  <td className="px-3 py-3">
                    <p className="font-medium">{u.full_name || "Unnamed user"}</p>
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
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate">
                    No users match the search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
