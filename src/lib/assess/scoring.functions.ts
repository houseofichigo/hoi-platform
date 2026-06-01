import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { MODULES, type ModuleId } from "@/lib/curriculum";
import { ARTIFACTS, GATES, isOutputPresent } from "@/lib/assess/completion";
import { fnv1aHash } from "@/lib/evidence/hash";

const ASSESSMENT_SCORING_VERSION = "1.0-hoi-executive";

type GateDecision = {
  gate_number: number;
  decision: string;
  constraints?: string[] | null;
  rationales?: string[] | null;
};

type ProgressRow = {
  module_id: string;
  status: string;
  studied: boolean;
  completed_at: string | null;
};

type OutputRow = {
  output_key: string;
  value: unknown;
  seeded?: boolean | null;
  touched?: boolean | null;
};

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function outputHasValue(row: OutputRow): boolean {
  const v = row.value;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

const CATEGORY_MODULES: Record<string, ModuleId[]> = {
  strategy_value: ["m01", "m09", "m12"],
  data_readiness: ["m02", "m04"],
  technology_delivery: ["m05", "m06", "m07", "m08"],
  operating_model: ["m10", "m11", "m12"],
  governance_readiness: ["m02", "m07", "m08", "m11"],
  adoption_learning: ["m03", "m05", "m10"],
};

const CATEGORY_LABELS: Record<string, string> = {
  strategy_value: "Strategy and value",
  data_readiness: "Data readiness",
  technology_delivery: "Technology and delivery",
  operating_model: "Operating model",
  governance_readiness: "Governance readiness",
  adoption_learning: "Adoption and learning",
};

function maturityLabel(score: number): string {
  if (score >= 85) return "Scaled";
  if (score >= 70) return "Deployment ready";
  if (score >= 55) return "Pilot ready";
  if (score >= 40) return "Foundation needed";
  return "Not ready";
}

export function computeAssessmentScore(input: {
  progress: ProgressRow[];
  outputs: OutputRow[];
  decisions: GateDecision[];
}) {
  const progressByModule = new Map(input.progress.map((row) => [row.module_id, row]));
  const presentOutputs = new Set(input.outputs.filter(outputHasValue).map((row) => row.output_key));
  const touchedOutputs = input.outputs.filter((row) => row.touched || !row.seeded).length;

  const moduleScores = MODULES.map((module) => {
    const progress = progressByModule.get(module.id);
    const artifactKeys = ARTIFACTS.filter((artifact) => artifact.modules.includes(module.id)).flatMap(
      (artifact) => artifact.outputKeys,
    );
    const ownedKeys = artifactKeys.filter((key) => key.startsWith(`${module.id}.`));
    const outputScore =
      ownedKeys.length === 0
        ? 0
        : (ownedKeys.filter((key) => isOutputPresent(key, presentOutputs)).length / ownedKeys.length) * 55;
    const progressScore =
      progress?.status === "complete" ? 35 : progress?.status === "in_progress" ? 18 : progress?.studied ? 10 : 0;
    const gate = GATES.find((g) => g.moduleId === module.id);
    const decision = gate ? input.decisions.find((d) => d.gate_number === gate.num) : null;
    const gateScore = !gate
      ? 10
      : decision?.decision === "continue"
        ? 10
        : decision?.decision === "constraints"
          ? 6
          : decision?.decision === "improve"
            ? 3
            : 0;
    return {
      module_id: module.id,
      title: module.title,
      phase: module.phase,
      score: clamp(outputScore + progressScore + gateScore),
      status: progress?.status ?? "not_started",
      missing_outputs: ownedKeys.filter((key) => !isOutputPresent(key, presentOutputs)),
    };
  });

  const categoryScores = Object.fromEntries(
    Object.entries(CATEGORY_MODULES).map(([category, moduleIds]) => {
      const rows = moduleScores.filter((row) => moduleIds.includes(row.module_id as ModuleId));
      const score = clamp(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length));
      return [
        category,
        {
          label: CATEGORY_LABELS[category],
          score,
          maturity: maturityLabel(score),
        },
      ];
    }),
  );

  const overallScore = clamp(moduleScores.reduce((sum, row) => sum + row.score, 0) / MODULES.length);
  const weakest = Object.entries(categoryScores)
    .map(([key, value]) => ({ key, ...(value as { label: string; score: number; maturity: string }) }))
    .sort((a, b) => a.score - b.score)[0];

  const gateRisks = input.decisions
    .filter((decision) => decision.decision === "improve" || decision.decision === "stop")
    .map((decision) => `GATE_${decision.gate_number}_${decision.decision.toUpperCase()}`);
  const reasonCodes = [
    ...gateRisks,
    ...moduleScores
      .filter((row) => row.score < 55)
      .slice(0, 5)
      .map((row) => `LOW_${row.module_id.toUpperCase()}_READINESS`),
  ];
  const evidenceConfidence = clamp(
    45 +
      (touchedOutputs / Math.max(1, input.outputs.length || 1)) * 35 +
      (input.decisions.length / Math.max(1, GATES.length)) * 20,
  );

  return {
    overall_score: overallScore,
    maturity_label: maturityLabel(overallScore),
    category_scores: categoryScores,
    module_scores: moduleScores,
    weakest_capability: weakest,
    evidence_confidence: evidenceConfidence,
    governance_readiness_indicators: {
      data_governance: (categoryScores.data_readiness as { score: number }).score,
      ai_governance: (categoryScores.governance_readiness as { score: number }).score,
      deployment_control: (categoryScores.operating_model as { score: number }).score,
    },
    recommended_actions: buildRecommendedActions(weakest?.key, overallScore, evidenceConfidence),
    reason_codes: reasonCodes,
  };
}

function buildRecommendedActions(weakestKey: string | undefined, score: number, confidence: number): string[] {
  const actions: string[] = [];
  if (weakestKey === "data_readiness") actions.push("Confirm data ownership, classification, access, and quality evidence before advancing high-autonomy Build use cases.");
  if (weakestKey === "governance_readiness") actions.push("Prepare EU AI Act, GDPR, ISO 42001, security/sector regulator, and IP review evidence before deployment planning.");
  if (weakestKey === "technology_delivery") actions.push("Clarify integration, rollback, monitoring, and HITL controls before production design.");
  if (weakestKey === "operating_model") actions.push("Assign service ownership, operating routines, audit cadence, and post-pilot review criteria.");
  if (score < 55) actions.push("Route the next step through Discover resources before approving new pilots.");
  if (confidence < 70) actions.push("Mark key evidence as verified or partially verified before using this assessment in an executive pack.");
  return actions.slice(0, 5);
}

const ScoreAssessmentInput = z.object({
  workspaceId: z.string().uuid(),
});

export const scoreAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ScoreAssessmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!membership) throw new Error("Not a workspace member");

    const [progressRes, outputsRes, decisionsRes] = await Promise.all([
      supabaseAdmin
        .from("assess_progress")
        .select("module_id, status, studied, completed_at")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", userId),
      supabaseAdmin
        .from("assess_outputs")
        .select("output_key, value, seeded, touched")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", userId),
      supabaseAdmin
        .from("assess_gate_decisions")
        .select("gate_number, decision, constraints, rationales")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", userId),
    ]);

    const error = progressRes.error ?? outputsRes.error ?? decisionsRes.error;
    if (error) throw new Error(error.message);

    const rawInputs = {
      progress: progressRes.data ?? [],
      outputs: outputsRes.data ?? [],
      decisions: decisionsRes.data ?? [],
    };
    const computed = computeAssessmentScore(rawInputs as {
      progress: ProgressRow[];
      outputs: OutputRow[];
      decisions: GateDecision[];
    });
    const inputHash = fnv1aHash(rawInputs);

    const { data: snapshot, error: insertErr } = await (supabaseAdmin as any)
      .from("assessment_score_snapshots")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        score_type: "assessment_maturity",
        scoring_model_version: ASSESSMENT_SCORING_VERSION,
        input_hash: inputHash,
        raw_inputs: rawInputs as Json,
        computed_outputs: {
          ...computed,
          scoringModelVersion: ASSESSMENT_SCORING_VERSION,
          inputHash,
        } as Json,
        reason_codes: computed.reason_codes,
        confidence: computed.evidence_confidence,
        computed_by: userId,
      } as never)
      .select("id, computed_at")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: data.workspaceId,
      actor_id: userId,
      action_type: "assessment_score_computed",
      entity_type: "assessment",
      entity_id: snapshot.id,
      entity_label: `Assessment maturity - ${computed.maturity_label}`,
      metadata: {
        overall_score: computed.overall_score,
        maturity_label: computed.maturity_label,
        weakest_capability: computed.weakest_capability,
        input_hash: inputHash,
      },
    } as never);

    return {
      id: snapshot.id,
      computedAt: snapshot.computed_at,
      scoringModelVersion: ASSESSMENT_SCORING_VERSION,
      inputHash,
      ...computed,
    };
  });
