import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminSettings } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const getSettings = useServerFn(getAdminSettings);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => getSettings(),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · SETTINGS"
        title="HOI admin access."
        lead="Internal admin roles are now separate from customer profiles. Manage role changes through SQL or a future audited server action."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading admin users…</p>
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
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate">
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
