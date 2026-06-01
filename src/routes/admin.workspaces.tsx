import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminWorkspaces } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/workspaces")({
  component: AdminWorkspaces,
});

function AdminWorkspaces() {
  const [search, setSearch] = useState("");
  const getWorkspaces = useServerFn(getAdminWorkspaces);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "workspaces"],
    queryFn: () => getWorkspaces(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((ws) => [ws.name, ws.slug, ws.plan].join(" ").toLowerCase().includes(q));
  }, [data, search]);

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
        placeholder="Search workspaces…"
        className="mb-4 w-full rounded-md border border-chalk bg-white px-3 py-2 text-[14px] outline-none focus:border-terracotta"
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading workspaces…</p>
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
                  <p className="text-[16px] font-semibold text-navy">{ws.name}</p>
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
            </article>
          ))}
        </div>
      )}
    </AdminShell>
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
