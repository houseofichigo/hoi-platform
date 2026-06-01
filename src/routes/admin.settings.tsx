import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminSettings, upsertHoiAdminUser } from "@/lib/admin/admin.functions";
import type { HoiAdminRole } from "@/hooks/useHoiAdmin";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const ROLES: HoiAdminRole[] = ["owner", "admin", "content_editor", "support", "billing_admin", "read_only"];

function AdminSettings() {
  const getSettings = useServerFn(getAdminSettings);
  const upsertAdmin = useServerFn(upsertHoiAdminUser);
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<HoiAdminRole>("read_only");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => getSettings(),
  });

  const save = useMutation({
    mutationFn: (args: { userId: string; role: HoiAdminRole; status: "active" | "suspended" }) =>
      upsertAdmin({ data: args }),
    onSuccess: () => {
      toast.success("Admin access updated");
      setUserId("");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · SETTINGS"
        title="HOI admin access."
        lead="Internal admin roles are separate from customer profiles. Role changes are audited and never use profiles.role as the source of truth."
      />

      <section className="mb-6 rounded-md border border-chalk bg-white p-5">
        <p className="eyebrow-muted">Add or update admin user</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Auth user UUID"
            className="input"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as HoiAdminRole)} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "suspended")} className="input">
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
          <button
            type="button"
            disabled={save.isPending || !userId.trim()}
            onClick={() => save.mutate({ userId: userId.trim(), role, status })}
            className="btn-ichigo btn-ichigo-primary text-[12px] disabled:opacity-50"
          >
            {save.isPending ? "Saving..." : "Save access"}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-slate">
          For safety, this uses the user UUID. Find it in the Users page or Supabase Auth before granting access.
        </p>
      </section>

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading admin users...</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-chalk bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-mist text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
              <tr>
                <th className="px-3 py-3 font-normal">User ID</th>
                <th className="px-3 py-3 font-normal">Role</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-3 py-3 font-normal">Created</th>
                <th className="px-3 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((admin) => (
                <tr key={admin.user_id} className="border-t border-chalk text-navy">
                  <td className="px-3 py-3 font-mono text-[11px] text-slate">{admin.user_id}</td>
                  <td className="px-3 py-3">{admin.role}</td>
                  <td className="px-3 py-3">{admin.status}</td>
                  <td className="px-3 py-3 text-slate">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setUserId(admin.user_id);
                        setRole(admin.role);
                        setStatus(admin.status);
                      }}
                      className="rounded-full border border-chalk px-3 py-1 text-[11px] text-navy hover:bg-mist"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate">
                    No HOI admins configured.
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
