import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deriveAndPersistGovernanceFlagsForUseCase } from "@/lib/scale/scale.functions";

const DecisionInput = z.object({
  approvalId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "returned"]),
  comment: z.string().max(4000).optional(),
});

export type ApprovalDecisionResult = {
  ok: true;
  decision: "approved" | "rejected" | "returned";
  useCaseStatus: "approved" | "rejected" | "capturing";
  governanceFlagsCreated: number;
};

function statusForDecision(decision: z.infer<typeof DecisionInput>["decision"]) {
  if (decision === "returned") return "capturing" as const;
  return decision;
}

export const decideBuildApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DecisionInput.parse(input))
  .handler(async ({ data, context }): Promise<ApprovalDecisionResult> => {
    const { supabase, userId } = context;

    const { data: approval, error: approvalErr } = await supabaseAdmin
      .from("use_case_approvals")
      .select("id, use_case_id, decision, comment")
      .eq("id", data.approvalId)
      .single();
    if (approvalErr || !approval) {
      throw new Error(approvalErr?.message ?? "Approval not found");
    }
    if (approval.use_case_id !== data.useCaseId) {
      throw new Error("Approval does not belong to this use case");
    }

    const { data: useCase, error: useCaseErr } = await supabaseAdmin
      .from("use_cases")
      .select("id, workspace_id, name, status")
      .eq("id", data.useCaseId)
      .single();
    if (useCaseErr || !useCase) {
      throw new Error(useCaseErr?.message ?? "Use case not found");
    }

    const { data: membership, error: membershipErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", useCase.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipErr) throw new Error(membershipErr.message);
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    if (!isAdmin) throw new Error("Only workspace admins can review use cases");

    const nextStatus = statusForDecision(data.decision);
    const reviewedAt = new Date().toISOString();
    const comment = data.comment?.trim() || null;

    const { error: approvalUpdateErr } = await supabase
      .from("use_case_approvals")
      .update({
        decision: data.decision,
        comment,
        reviewed_by: userId,
        reviewed_at: reviewedAt,
      })
      .eq("id", data.approvalId);
    if (approvalUpdateErr) throw new Error(approvalUpdateErr.message);

    const { error: useCaseUpdateErr } = await supabase
      .from("use_cases")
      .update({ status: nextStatus })
      .eq("id", data.useCaseId);
    if (useCaseUpdateErr) throw new Error(useCaseUpdateErr.message);

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: useCase.workspace_id,
      actor_id: userId,
      action_type: "build_approval_decided",
      entity_type: "use_case",
      entity_id: useCase.id,
      entity_label: useCase.name,
      before_state: {
        status: useCase.status,
        approval_decision: approval.decision,
        approval_comment: approval.comment,
      },
      after_state: {
        status: nextStatus,
        approval_decision: data.decision,
        approval_comment: comment,
        reviewed_at: reviewedAt,
      },
      metadata: {
        approval_id: data.approvalId,
        source: "build_approval_review",
      },
    });

    let governanceFlagsCreated = 0;
    if (data.decision === "approved") {
      const flags = await deriveAndPersistGovernanceFlagsForUseCase({
        useCaseId: data.useCaseId,
        actorId: userId,
        source: "build_approval",
      });
      governanceFlagsCreated = flags.created;
    }

    return {
      ok: true,
      decision: data.decision,
      useCaseStatus: nextStatus,
      governanceFlagsCreated,
    };
  });
