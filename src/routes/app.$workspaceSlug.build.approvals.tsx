import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useApprovals } from "@/hooks/useBuild";

export const Route = createFileRoute("/app/$workspaceSlug/build/approvals")({
  component: ApprovalsPage,
});

function useReviewApproval() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async (input: { approvalId: string; useCaseId: string; decision: "approved" | "rejected"; comment: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("use_case_approvals")
        .update({
          decision: input.decision,
          comment: input.comment || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.approvalId);
      if (error) throw error;
      const { error: ucErr } = await supabase
        .from("use_cases")
        .update({ status: input.decision })
        .eq("id", input.useCaseId);
      if (ucErr) throw ucErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_case_approvals_all", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["use_cases", workspace?.id] });
    },
  });
}

function ApprovalsPage() {
  const { data: approvals = [], isLoading } = useApprovals();
  const review = useReviewApproval();
  const [comments, setComments] = useState<Record<string, string>>({});

  const decide = async (a: (typeof approvals)[number], decision: "approved" | "rejected") => {
    try {
      await review.mutateAsync({
        approvalId: a.id,
        useCaseId: a.use_case_id,
        decision,
        comment: comments[a.id] ?? "",
      });
      toast.success(`Marked ${decision}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const pending = approvals.filter((a) => a.decision === "pending");
  const decided = approvals.filter((a) => a.decision !== "pending");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-[20px] text-navy">Pending ({pending.length})</h2>
        {isLoading ? (
          <p className="mt-3 text-[13px] text-graphite">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="mt-3 text-[13px] text-graphite">Nothing waiting on you.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                      {a.use_cases.function} · submitted {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}
                    </p>
                    <h3 className="mt-1 font-display text-[18px] text-navy">{a.use_cases.name}</h3>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={comments[a.id] ?? ""}
                  onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })}
                  placeholder="Review comment (optional)"
                  className="mt-3 w-full rounded-md border border-chalk bg-paper px-3 py-2 text-[13px] outline-none focus:border-terracotta"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => decide(a, "rejected")}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-navy px-3 py-1.5 text-[13px] font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                  <button
                    onClick={() => decide(a, "approved")}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="font-display text-[20px] text-navy">Recently decided</h2>
          <ul className="mt-3 divide-y divide-chalk">
            {decided.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[14px] font-medium text-navy">{a.use_cases.name}</p>
                  <p className="text-[11px] text-graphite">
                    {a.decision} · {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    a.decision === "approved" ? "bg-terracotta text-white" : "bg-chalk text-navy",
                  ].join(" ")}
                >
                  {a.decision}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
