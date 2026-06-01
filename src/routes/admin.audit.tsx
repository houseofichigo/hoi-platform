import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminAudit, type AdminAuditEntry } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  const getAudit = useServerFn(getAdminAudit);
  const { data = [], isLoading, error } = useQuery<AdminAuditEntry[]>({
    queryKey: ["admin", "audit"],
    queryFn: () => getAudit(),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · AUDIT"
        title="Internal audit log."
        lead="Append-only HOI admin activity. This starts empty until privileged admin actions begin writing events."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading audit log…</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-chalk bg-white">
          {data.length === 0 ? (
            <p className="p-8 text-center text-[14px] text-slate">No internal admin events yet.</p>
          ) : (
            <div className="divide-y divide-chalk">
              {data.map((entry) => (
                <div key={entry.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-navy">{entry.action_type}</p>
                      <p className="text-[12px] text-slate">
                        {entry.entity_type}
                        {entry.entity_label ? ` · ${entry.entity_label}` : ""}
                      </p>
                    </div>
                    <p className="text-[12px] text-slate">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
