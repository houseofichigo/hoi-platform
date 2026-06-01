import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import { getAdminSupport, resolveAdminSupportSignal } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupport,
});

const KIND_LABEL: Record<string, string> = {
  pending_invite: "Pending invite",
  pending_approval: "Build approval",
  open_governance_flag: "Governance flag",
  incomplete_onboarding: "Onboarding",
};

function AdminSupport() {
  const [kindFilter, setKindFilter] = useState("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const getSupport = useServerFn(getAdminSupport);
  const resolveSignal = useServerFn(resolveAdminSupportSignal);
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "support"],
    queryFn: () => getSupport(),
  });

  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const item of data) out.set(item.kind, (out.get(item.kind) ?? 0) + 1);
    return out;
  }, [data]);
  const filtered = kindFilter === "all" ? data : data.filter((item) => item.kind === kindFilter);

  const resolve = useMutation({
    mutationFn: () =>
      resolveSignal({
        data: {
          supportId: resolvingId!,
          note: resolutionNote,
        },
      }),
    onSuccess: () => {
      toast.success("Support signal closed");
      setResolvingId(null);
      setResolutionNote("");
      qc.invalidateQueries({ queryKey: ["admin", "support"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · SUPPORT"
        title="Support queue."
        lead="Signals for customer-success follow-up: onboarding gaps, pending invites, approvals, and governance flags."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(KIND_LABEL).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setKindFilter(kind)}
            className={[
              "rounded-md border p-3 text-left",
              kindFilter === kind ? "border-navy bg-navy text-white" : "border-chalk bg-white text-navy",
            ].join(" ")}
          >
            <p className="text-[12px]">{label}</p>
            <p className="mt-1 text-[22px] font-semibold">{counts.get(kind) ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setKindFilter("all")}
          className="rounded-full border border-chalk px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
        >
          Show all ({data.length})
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading support queue...</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article key={`${item.kind}:${item.id}`} className="rounded-md border border-chalk bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                    {KIND_LABEL[item.kind] ?? item.kind.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-navy">{item.title}</p>
                  <p className="mt-1 text-[13px] text-graphite">{item.detail}</p>
                </div>
                <div className="text-right text-[12px] text-slate">
                  <p>{item.workspace_name || "No workspace"}</p>
                  <p>{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {resolvingId === item.id ? (
                <div className="mt-4 rounded-md border border-chalk bg-mist p-3">
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    rows={3}
                    placeholder="What did we do, or why is this no longer actionable?"
                    className="input text-[13px]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => resolve.mutate()}
                      disabled={resolve.isPending || resolutionNote.trim().length < 2}
                      className="btn-ichigo btn-ichigo-primary text-[12px] disabled:opacity-50"
                    >
                      {resolve.isPending ? "Closing..." : "Close signal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId(null);
                        setResolutionNote("");
                      }}
                      className="btn-ichigo btn-ichigo-outline text-[12px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setResolvingId(item.id)}
                    className="rounded-full border border-chalk px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
                  >
                    Add resolution note
                  </button>
                  {item.workspace_id && (
                    <a
                      href={`/admin/workspaces`}
                      className="rounded-full border border-chalk px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
                    >
                      Open workspace directory
                    </a>
                  )}
                </div>
              )}
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-md border border-chalk bg-white p-8 text-center text-[14px] text-slate">
              Nothing needs support attention in this view.
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
