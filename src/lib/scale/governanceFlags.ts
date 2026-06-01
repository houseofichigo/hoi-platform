// Pure helper for deriving EU/HOI governance flags from Build score + capture data
// and roadmap stage transitions. Used by the post-approval flow and by
// moveRoadmapEntry to seed `governance_flags`.
// Pure / unit-testable; no Supabase imports.

import type { RoadmapStage } from "./types";

export type GovernanceRuleSource = "eu_ai_act" | "gdpr" | "internal_policy";
export type GovernanceSeverity = "hard_stop" | "requires_action" | "advisory";

export type GovernanceRuleCode =
  | "EU_AI_ACT_HIGH_RISK"
  | "ARTICLE_11_DOCUMENTATION"
  | "HITL_REQUIRED_ART14"
  | "TRANSPARENCY_ART13"
  | "CONFORMITY_ASSESSMENT"
  | "DPIA_REQUIRED"
  | "DATA_MINIMISATION"
  | "RIGHT_TO_EXPLANATION"
  | "SECURITY_REVIEW_REQUIRED"
  | "CHANGE_MANAGEMENT";

export interface DerivedGovernanceFlag {
  rule_code: GovernanceRuleCode;
  rule_source: GovernanceRuleSource;
  severity: GovernanceSeverity;
  metadata: Record<string, unknown>;
}

export interface DeriveInput {
  useCaseFunction?: string | null;
  reasonCodes?: string[];
  capture: Record<string, unknown>;
  /**
   * Optional roadmap stage context. When provided, stage-driven rules
   * (Article 11 documentation on reaching production, CHANGE_MANAGEMENT on
   * Pilot -> Production) will be included.
   */
  stage?: RoadmapStage;
  fromStage?: RoadmapStage | null;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}
function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function isYes(v: unknown): boolean {
  const x = s(v).toLowerCase();
  return x === "yes" || x === "true";
}

function isCustomerFacing(cap: Record<string, unknown>): boolean {
  if (isYes(cap.customer_facing_choice)) return true;
  return s(cap.target_domain) === "customer_facing";
}

function automatedDecisionsAffectIndividuals(
  cap: Record<string, unknown>,
  decisionLogic: string,
  hasPersonal: boolean,
): boolean {
  if (isYes(cap.automated_decisions_affect_individuals_choice)) return true;
  const isAutomatedDecision =
    decisionLogic === "model_based" ||
    decisionLogic === "rules_plus_model" ||
    decisionLogic === "agentic" ||
    decisionLogic === "mixed";
  return hasPersonal && isAutomatedDecision;
}

export function deriveGovernanceFlags(input: DeriveInput): DerivedGovernanceFlag[] {
  const flags: DerivedGovernanceFlag[] = [];
  const codes = new Set(input.reasonCodes ?? []);
  const cap = input.capture ?? {};
  const fn = (input.useCaseFunction ?? "").toLowerCase();
  const stage = input.stage;
  const fromStage = input.fromStage ?? null;

  const personal = s(cap.personal_data) || s(cap.personal_data_choice);
  const hasPersonal =
    cap.personal_data === true ||
    (personal !== "" && personal !== "none" && personal !== "no");
  const classification = s(cap.classification) || s(cap.data_classification);

  const decisionLogic =
    s(cap.decision_logic_type) ||
    s(cap.decision_logic) ||
    s(cap.decision_logic_choice);
  const automatedDecisions =
    decisionLogic === "deterministic" ||
    decisionLogic === "model_based" ||
    decisionLogic === "rules_plus_model" ||
    decisionLogic === "agentic" ||
    decisionLogic === "mixed";

  const scopeChips = arr(cap.scope_chips);
  const broadProcessing = scopeChips.length >= 4 || s(cap.data_scope) === "broad";
  const customerFacing = isCustomerFacing(cap);
  const affectsIndividuals = automatedDecisionsAffectIndividuals(cap, decisionLogic, hasPersonal);

  const highRiskFunction = fn === "finance" || fn === "hr" || fn === "legal";
  const impact =
    s(cap.impact) ||
    s(cap.business_impact) ||
    s(cap.impact_if_failure) ||
    s(cap.impact_if_failure_choice) ||
    s(cap.error_reversibility);
  const materialImpact =
    impact === "material" ||
    impact === "catastrophic" ||
    impact === "high" ||
    impact === "critical" ||
    impact === "irreversible" ||
    codes.has("IRREVERSIBLE_ERRORS");

  let highRiskSeverity: GovernanceSeverity | null = null;
  if (highRiskFunction && materialImpact) {
    highRiskSeverity = "hard_stop";
    flags.push({
      rule_code: "EU_AI_ACT_HIGH_RISK",
      rule_source: "eu_ai_act",
      severity: "hard_stop",
      metadata: { function: fn, impact: impact || "inferred_from_reason_codes" },
    });
  } else if (highRiskFunction || materialImpact) {
    highRiskSeverity = "requires_action";
    flags.push({
      rule_code: "EU_AI_ACT_HIGH_RISK",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: { function: fn || null, impact: impact || null, partial_match: true },
    });
  }

  if (highRiskSeverity === "hard_stop") {
    flags.push({
      rule_code: "CONFORMITY_ASSESSMENT",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: {
        trigger: "EU_AI_ACT_HIGH_RISK=hard_stop",
        function: fn,
        impact: impact || null,
      },
    });
  }

  if (codes.has("HITL_MANDATORY") || s(cap.hitl_decisions) === "mandatory") {
    flags.push({
      rule_code: "HITL_REQUIRED_ART14",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: { trigger: "hitl_mandatory" },
    });
  }

  if (customerFacing) {
    flags.push({
      rule_code: "TRANSPARENCY_ART13",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: {
        customer_facing: true,
        signal_source: isYes(cap.customer_facing_choice)
          ? "customer_facing_choice"
          : "target_domain",
      },
    });
  }

  if (stage === "production") {
    flags.push({
      rule_code: "ARTICLE_11_DOCUMENTATION",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: { trigger: "stage_reached_production", from_stage: fromStage },
    });
  }

  if (hasPersonal && (automatedDecisions || broadProcessing)) {
    flags.push({
      rule_code: "DPIA_REQUIRED",
      rule_source: "gdpr",
      severity: "requires_action",
      metadata: {
        personal_data: hasPersonal,
        automated_decisions: automatedDecisions,
        broad_processing: broadProcessing,
      },
    });
  }

  if (broadProcessing || classification === "restricted" || classification === "confidential") {
    flags.push({
      rule_code: "DATA_MINIMISATION",
      rule_source: "gdpr",
      severity: broadProcessing ? "advisory" : "requires_action",
      metadata: {
        scope_chip_count: scopeChips.length,
        classification: classification || null,
      },
    });
  }

  if (affectsIndividuals) {
    flags.push({
      rule_code: "RIGHT_TO_EXPLANATION",
      rule_source: "gdpr",
      severity: "requires_action",
      metadata: {
        signal_source: isYes(cap.automated_decisions_affect_individuals_choice)
          ? "automated_decisions_affect_individuals_choice"
          : "inferred_personal_plus_automated",
        decision_logic: decisionLogic || null,
        personal_data: hasPersonal,
      },
    });
  }

  const foreignVendor = s(cap.foreign_vendor) || s(cap.foreign_vendor_choice);
  const hasForeign =
    cap.foreign_vendor_access === true ||
    (foreignVendor !== "" && foreignVendor !== "none" && foreignVendor !== "no") ||
    codes.has("FOREIGN_DATA_ACCESS");
  const integrations = arr(cap.integrations_chips).length || (n(cap.integration_count) ?? 0);

  if (hasForeign || integrations >= 3 || classification === "restricted") {
    flags.push({
      rule_code: "SECURITY_REVIEW_REQUIRED",
      rule_source: "internal_policy",
      severity: hasForeign || classification === "restricted" ? "requires_action" : "advisory",
      metadata: {
        foreign_vendor: hasForeign || null,
        integration_count: integrations,
        classification: classification || null,
      },
    });
  }

  if (fromStage === "pilot" && stage === "production") {
    flags.push({
      rule_code: "CHANGE_MANAGEMENT",
      rule_source: "internal_policy",
      severity: "requires_action",
      metadata: { trigger: "pilot_to_production" },
    });
  }

  return dedupeFlags(flags);
}

function dedupeFlags(flags: DerivedGovernanceFlag[]): DerivedGovernanceFlag[] {
  const severityRank: Record<GovernanceSeverity, number> = {
    advisory: 0,
    requires_action: 1,
    hard_stop: 2,
  };
  const byCode = new Map<GovernanceRuleCode, DerivedGovernanceFlag>();
  for (const flag of flags) {
    const existing = byCode.get(flag.rule_code);
    if (!existing || severityRank[flag.severity] > severityRank[existing.severity]) {
      byCode.set(flag.rule_code, flag);
    } else if (existing) {
      existing.metadata = { ...existing.metadata, ...flag.metadata };
    }
  }
  return Array.from(byCode.values());
}
