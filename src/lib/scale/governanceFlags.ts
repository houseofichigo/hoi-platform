// Pure helper for deriving KSA governance flags from Build score + capture data
// and roadmap stage transitions. Used by the post-approval flow and by
// moveRoadmapEntry to seed `governance_flags`.
// Pure / unit-testable; no Supabase imports.

import type { RoadmapStage } from "./types";

export type GovernanceRuleSource =
  | "sdaia"
  | "pdpl"
  | "ndmo"
  | "nca_sama"
  | "saip"
  | "internal_policy";
export type GovernanceSeverity = "hard_stop" | "requires_action" | "advisory";

export type GovernanceRuleCode =
  // SDAIA / AI ethics and deployment controls
  | "SDAIA_HIGH_IMPACT_AI"
  | "SDAIA_HUMAN_OVERSIGHT_REQUIRED"
  | "SDAIA_TRANSPARENCY_REQUIRED"
  | "SDAIA_TECHNICAL_DOCUMENTATION"
  | "SDAIA_MODEL_VALIDATION_REQUIRED"
  // PDPL
  | "PDPL_PRIVACY_IMPACT_REVIEW"
  | "PDPL_DATA_MINIMISATION"
  | "PDPL_CROSS_BORDER_REVIEW"
  // NDMO
  | "NDMO_DATA_GOVERNANCE_REVIEW"
  // NCA / SAMA
  | "NCA_SAMA_SECURITY_REVIEW"
  // SAIP
  | "SAIP_IP_REVIEW"
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
   * (SDAIA_TECHNICAL_DOCUMENTATION on reaching production, CHANGE_MANAGEMENT on
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
  // SDAIA / high-impact AI deployment controls
  // -------------------------------------------------------------------------

  // SDAIA_HIGH_IMPACT_AI
  let highImpactSeverity: GovernanceSeverity | null = null;
  if (highRiskFn && materialImpact) {
    highImpactSeverity = "hard_stop";
    flags.push({
      rule_code: "SDAIA_HIGH_IMPACT_AI",
      rule_source: "sdaia",
      severity: "hard_stop",
      metadata: { function: fn, impact: impact || "inferred_from_reason_codes" },
    });
  } else if (highRiskFn || materialImpact) {
    highImpactSeverity = "requires_action";
    flags.push({
      rule_code: "SDAIA_HIGH_IMPACT_AI",
      rule_source: "sdaia",
      severity: "requires_action",
      metadata: {
        function: fn || null,
        impact: impact || null,
        partial_match: true,
      },
    });
  }

  // SDAIA_MODEL_VALIDATION_REQUIRED - high-impact AI requires validation before deployment.
  if (highImpactSeverity === "hard_stop") {
    flags.push({
      rule_code: "SDAIA_MODEL_VALIDATION_REQUIRED",
      rule_source: "sdaia",
      severity: "requires_action",
      metadata: {
        trigger: "SDAIA_HIGH_IMPACT_AI=hard_stop",
        function: fn,
        impact: impact || null,
      },
    });
  }

  // SDAIA_HUMAN_OVERSIGHT_REQUIRED
  if (codes.has("HITL_MANDATORY") || s(cap.hitl_decisions) === "mandatory") {
    flags.push({
      rule_code: "SDAIA_HUMAN_OVERSIGHT_REQUIRED",
      rule_source: "sdaia",
      severity: "requires_action",
      metadata: { trigger: "hitl_mandatory" },
    });
  }

  // SDAIA_TRANSPARENCY_REQUIRED - structured customer-facing signal.
  if (customerFacing) {
    flags.push({
      rule_code: "SDAIA_TRANSPARENCY_REQUIRED",
      rule_source: "sdaia",
      severity: "requires_action",
      metadata: {
        customer_facing: true,
        signal_source: isYes(cap.customer_facing_choice)
          ? "customer_facing_choice"
          : "target_domain",
      },
    });
  }

  // SDAIA_TECHNICAL_DOCUMENTATION - required once the use case reaches production.
  if (stage === "production") {
    flags.push({
      rule_code: "SDAIA_TECHNICAL_DOCUMENTATION",
      rule_source: "sdaia",
      severity: "requires_action",
      metadata: { trigger: "stage_reached_production", from_stage: fromStage },
    });
  }

  // -------------------------------------------------------------------------
  // PDPL
  // -------------------------------------------------------------------------

  // PDPL_PRIVACY_IMPACT_REVIEW - personal data + automated decisions or broad processing.
  if (hasPersonal && (automatedDecisions || broadProcessing)) {
    flags.push({
      rule_code: "PDPL_PRIVACY_IMPACT_REVIEW",
      rule_source: "pdpl",
      severity: "requires_action",
      metadata: {
        personal_data: hasPersonal,
        automated_decisions: automatedDecisions,
        broad_processing: broadProcessing,
      },
    });
  }

  // PDPL_DATA_MINIMISATION - advisory when scope appears broad.
  if (broadProcessing) {
    flags.push({
      rule_code: "PDPL_DATA_MINIMISATION",
      rule_source: "pdpl",
      severity: "advisory",
      metadata: { scope_chip_count: scopeChips.length },
    });
  }

  // PDPL notice/review duty for automated decisions affecting individuals.
  if (adAffectIndividuals) {
    flags.push({
      rule_code: "PDPL_PRIVACY_IMPACT_REVIEW",
      rule_source: "pdpl",
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

  // PDPL_CROSS_BORDER_REVIEW - personal data plus external/foreign vendor access.
  const foreignVendor = s(cap.foreign_vendor) || s(cap.foreign_vendor_choice);
  const hasForeign =
    cap.foreign_vendor_access === true ||
    (foreignVendor !== "" && foreignVendor !== "none" && foreignVendor !== "no") ||
    codes.has("FOREIGN_DATA_ACCESS");
  if (hasPersonal && hasForeign) {
    flags.push({
      rule_code: "PDPL_CROSS_BORDER_REVIEW",
      rule_source: "pdpl",
      severity: "requires_action",
      metadata: { personal_data: true, foreign_vendor: true },
    });
  }

  // -------------------------------------------------------------------------
  // NDMO / data governance
  // -------------------------------------------------------------------------

  if (classification === "confidential" || classification === "restricted" || broadProcessing) {
    flags.push({
      rule_code: "NDMO_DATA_GOVERNANCE_REVIEW",
      rule_source: "ndmo",
      severity: classification === "restricted" ? "requires_action" : "advisory",
      metadata: {
        classification: classification || null,
        broad_processing: broadProcessing,
      },
    });
  }

  // -------------------------------------------------------------------------
  // NCA / SAMA / SAIP / internal policy
  // -------------------------------------------------------------------------

  const integrations =
    arr(cap.integrations_chips).length || (n(cap.integration_count) ?? 0);

  if (hasForeign || integrations >= 3 || classification === "restricted") {
    flags.push({
      rule_code: "NCA_SAMA_SECURITY_REVIEW",
      rule_source: "nca_sama",
      severity: hasForeign || classification === "restricted" ? "requires_action" : "advisory",
      metadata: {
        foreign_vendor: hasForeign || null,
        integration_count: integrations,
        classification: classification || null,
      },
    });
  }

  if (
    s(cap.vendor_model_reuse) === "yes" ||
    s(cap.training_data_origin) === "third_party" ||
    codes.has("THIRD_PARTY_IP")
  ) {
    flags.push({
      rule_code: "SAIP_IP_REVIEW",
      rule_source: "saip",
      severity: "advisory",
      metadata: {
        vendor_model_reuse: s(cap.vendor_model_reuse) || null,
        training_data_origin: s(cap.training_data_origin) || null,
      },
    });
  }

  // SECURITY_REVIEW_REQUIRED - internal review mirror for security-sensitive cases.
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
