// Pure helper for deriving governance flags from Build score + capture data
// (and, for stage-driven rules, roadmap stage transitions). Used by the
// post-approval flow and by moveRoadmapEntry to seed `governance_flags`.
// Pure / unit-testable; no Supabase imports.

import type { RoadmapStage } from "./types";

export type GovernanceRuleSource = "eu_ai_act" | "gdpr" | "internal_policy";
export type GovernanceSeverity = "hard_stop" | "requires_action" | "advisory";

export type GovernanceRuleCode =
  // EU AI Act
  | "EU_AI_ACT_HIGH_RISK"
  | "ARTICLE_11_DOCUMENTATION"
  | "HITL_REQUIRED_ART14"
  | "TRANSPARENCY_ART13"
  | "CONFORMITY_ASSESSMENT"
  // GDPR
  | "DPIA_REQUIRED"
  | "DATA_MINIMISATION"
  | "RIGHT_TO_EXPLANATION"
  // Internal policy
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
   * (ARTICLE_11_DOCUMENTATION on reaching production, CHANGE_MANAGEMENT on
   * Pilot → Production) will be included.
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

// ---------------------------------------------------------------------------
// Structured signal extractors. The "structured" requirement means the answer
// must come from a known capture key, not an inferred substring of free text.
// ---------------------------------------------------------------------------
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
  // Fallback inference: model-based / agentic decisions on personal data.
  const isAutomatedDecision =
    decisionLogic === "model_based" || decisionLogic === "agentic";
  return hasPersonal && isAutomatedDecision;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export function deriveGovernanceFlags(input: DeriveInput): DerivedGovernanceFlag[] {
  const flags: DerivedGovernanceFlag[] = [];
  const codes = new Set(input.reasonCodes ?? []);
  const cap = input.capture ?? {};
  const fn = (input.useCaseFunction ?? "").toLowerCase();
  const stage = input.stage;
  const fromStage = input.fromStage ?? null;

  // Shared computed signals
  const personal = s(cap.personal_data) || s(cap.personal_data_choice);
  const hasPersonal =
    cap.personal_data === true ||
    (personal !== "" && personal !== "none" && personal !== "no");

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
  const adAffectIndividuals = automatedDecisionsAffectIndividuals(
    cap,
    decisionLogic,
    hasPersonal,
  );

  const highRiskFn = fn === "finance" || fn === "hr" || fn === "legal";
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

  // -------------------------------------------------------------------------
  // EU AI Act
  // -------------------------------------------------------------------------

  // EU_AI_ACT_HIGH_RISK
  let euHighRiskSeverity: GovernanceSeverity | null = null;
  if (highRiskFn && materialImpact) {
    euHighRiskSeverity = "hard_stop";
    flags.push({
      rule_code: "EU_AI_ACT_HIGH_RISK",
      rule_source: "eu_ai_act",
      severity: "hard_stop",
      metadata: { function: fn, impact: impact || "inferred_from_reason_codes" },
    });
  } else if (highRiskFn || materialImpact) {
    euHighRiskSeverity = "requires_action";
    flags.push({
      rule_code: "EU_AI_ACT_HIGH_RISK",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: {
        function: fn || null,
        impact: impact || null,
        partial_match: true,
      },
    });
  }

  // CONFORMITY_ASSESSMENT — when EU_AI_ACT_HIGH_RISK is high-risk (hard_stop).
  if (euHighRiskSeverity === "hard_stop") {
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

  // HITL_REQUIRED_ART14
  if (codes.has("HITL_MANDATORY") || s(cap.hitl_decisions) === "mandatory") {
    flags.push({
      rule_code: "HITL_REQUIRED_ART14",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: { trigger: "hitl_mandatory" },
    });
  }

  // TRANSPARENCY_ART13 — structured customer-facing signal.
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

  // ARTICLE_11_DOCUMENTATION — required once the use case reaches production.
  if (stage === "production") {
    flags.push({
      rule_code: "ARTICLE_11_DOCUMENTATION",
      rule_source: "eu_ai_act",
      severity: "requires_action",
      metadata: { trigger: "stage_reached_production", from_stage: fromStage },
    });
  }

  // -------------------------------------------------------------------------
  // GDPR
  // -------------------------------------------------------------------------

  // DPIA_REQUIRED — personal data + automated decisions or broad processing.
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

  // DATA_MINIMISATION — advisory when scope appears broad.
  if (broadProcessing) {
    flags.push({
      rule_code: "DATA_MINIMISATION",
      rule_source: "gdpr",
      severity: "advisory",
      metadata: { scope_chip_count: scopeChips.length },
    });
  }

  // RIGHT_TO_EXPLANATION — automated decisions affecting individuals.
  if (adAffectIndividuals) {
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

  // -------------------------------------------------------------------------
  // Internal policy
  // -------------------------------------------------------------------------

  // SECURITY_REVIEW_REQUIRED — foreign-vendor access OR many integrations.
  const foreignVendor = s(cap.foreign_vendor) || s(cap.foreign_vendor_choice);
  const hasForeign =
    cap.foreign_vendor_access === true ||
    (foreignVendor !== "" && foreignVendor !== "none" && foreignVendor !== "no") ||
    codes.has("FOREIGN_DATA_ACCESS");
  const integrations =
    arr(cap.integrations_chips).length || (n(cap.integration_count) ?? 0);
  if (hasForeign || integrations >= 3) {
    flags.push({
      rule_code: "SECURITY_REVIEW_REQUIRED",
      rule_source: "internal_policy",
      severity: "requires_action",
      metadata: {
        foreign_vendor: hasForeign || null,
        integration_count: integrations,
      },
    });
  }

  // CHANGE_MANAGEMENT — created on Pilot → Production.
  if (fromStage === "pilot" && stage === "production") {
    flags.push({
      rule_code: "CHANGE_MANAGEMENT",
      rule_source: "internal_policy",
      severity: "requires_action",
      metadata: { trigger: "pilot_to_production" },
    });
  }

  return flags;
}
