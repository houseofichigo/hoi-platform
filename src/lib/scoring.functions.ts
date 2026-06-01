import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

type AnyObj = Record<string, unknown>;

// ============================================================================
// SCORING_WEIGHTS — single source of truth for every magic number.
// ============================================================================
export const SCORING_WEIGHTS = {
  // ----- Enum score maps (0-100). MISSING handled separately, no midpoint default.
  enums: {
    objectives_present: 70,
    objectives_missing: 20,
    metric_present: 90,
    metric_missing: 0,
    output_criticality: { low: 30, medium: 55, high: 80, critical: 95 } as Record<string, number>,
    accessibility: { api: 95, export: 65, manual: 35, none: 0 } as Record<string, number>,
    data_readiness: { ready: 95, partial: 65, fragmented: 45, poor: 30, missing: 0 } as Record<string, number>,
    structure: { structured: 90, semi_structured: 60, mixed: 65, unstructured: 35 } as Record<string, number>,
    standardisation: { high: 90, medium: 60, low: 25, inconsistent: 15 } as Record<string, number>,
    rules_documentation: { yes: 90, partial: 55, no: 20 } as Record<string, number>,
    owner_present: 90,
    owner_missing: 20,
    reversibility_risk: { easy: 10, moderate: 30, hard: 65, irreversible: 95 } as Record<string, number>,
    classification_risk: { public: 10, internal: 30, confidential: 60, restricted: 90 } as Record<string, number>,
    risk_tolerance: { high: 20, medium: 50, low: 80 } as Record<string, number>,
    pii_risk_yes: 70,
    pii_risk_no: 20,
    shape_ai_fit: {
      workflow_automation: 65,
      classification: 90,
      extraction: 85,
      generation: 75,
      decision_support: 70,
      agentic_workflow: 80,
      search_qa: 85,
      monitoring_control: 70,
      other: 45,
    } as Record<string, number>,
    historical_fit: { yes: 85, partial: 55, no: 25 } as Record<string, number>,
    // Missing markers (conservative — low for "positive" pillars, high for risk)
    missing_positive: 15,
    missing_risk: 70,
  },
  // ----- Formula weights
  delivery_readiness: { process_maturity: 0.6, feasibility: 0.4 },
  priority: { business_impact: 0.4, delivery_readiness: 0.4, low_risk: 0.2 },
  // ----- Quadrant / tier thresholds
  quadrant_threshold: 60,
  high_exception_rate: 30,
  unsafe_step_automation_level: 4,
  // ----- Agent suitability components (start at base, add/subtract)
  agent: {
    base: 50,
    multi_step_bonus: 10, // >= 3 workflow steps
    good_access_bonus: 10, // accessScore > 60
    poor_access_penalty: 10, // accessScore < 35
    reliable_trigger_bonus: 10, // event / scheduled
    manual_trigger_penalty: 10,
    high_automation_bonus: 10, // avg automation >= 3
    hitl_mandatory_penalty: 20,
    irreversible_penalty: 25,
    hard_to_reverse_penalty: 10,
    actionability_yes: 10,
    actionability_no: 10,
    rollback_yes: 10,
    rollback_no: 10,
    monitoring_yes: 10,
    monitoring_no: 10,
  },
} as const;

// ============================================================================
// Reason-code taxonomy
// ============================================================================
export const REASON_CODE_SEVERITY = {
  // Hard stops — cannot be Tier 1
  NO_SUCCESS_METRIC: "hard_stop",
  NO_DATA_ACCESS: "hard_stop",
  NO_API: "hard_stop",
  DATA_NOT_ACCESSIBLE: "hard_stop",
  SCOPE_UNDEFINED: "hard_stop",
  // Design constraints — workable but constrain Tier 1
  HITL_MANDATORY: "design_constraint",
  IRREVERSIBLE_ERRORS: "design_constraint",
  HIGH_EXCEPTION_RATE: "design_constraint",
  PII_PRESENT: "design_constraint",
  FOREIGN_DATA_ACCESS: "design_constraint",
  STEP_AUTOMATION_UNSAFE: "design_constraint",
  // Watch items
  LOW_STANDARDIZATION: "watch_item",
  NO_MONITORING_PATH: "watch_item",
  NO_ROLLBACK_PATH: "watch_item",
  RULES_UNDOCUMENTED: "watch_item",
  NO_HISTORICAL_DATA: "watch_item",
  TRIGGER_MANUAL: "watch_item",
  OUTPUT_NOT_VERIFIABLE: "watch_item",
  NO_PROCESS_OWNER: "watch_item",
  // Missing-input codes (treated as watch_item; they also lower pillar scores)
  MISSING_SUCCESS_METRIC: "watch_item",
  MISSING_DATA_READINESS: "watch_item",
  MISSING_DATA_ACCESS: "watch_item",
  MISSING_SCOPE: "watch_item",
  MISSING_PROCESS_OWNER: "watch_item",
  MISSING_MONITORING_PLAN: "watch_item",
  MISSING_ROLLBACK_PATH: "watch_item",
  MISSING_OUTPUT_CRITICALITY: "watch_item",
  MISSING_REVERSIBILITY: "watch_item",
  MISSING_STRUCTURE: "watch_item",
  MISSING_HITL: "watch_item",
} as const;

export type ReasonCode = keyof typeof REASON_CODE_SEVERITY;
export type ReasonSeverity = "hard_stop" | "design_constraint" | "watch_item";

export const HARD_STOP_CODES = Object.entries(REASON_CODE_SEVERITY)
  .filter(([, s]) => s === "hard_stop")
  .map(([c]) => c);
export const DESIGN_CONSTRAINT_CODES = Object.entries(REASON_CODE_SEVERITY)
  .filter(([, s]) => s === "design_constraint")
  .map(([c]) => c);

// ============================================================================
// classifyOutcome — pure quadrant + tier classifier (unit-tested directly)
// ============================================================================
export interface ClassifyInput {
  priority: number;
  delivery_readiness: number;
  reason_codes: string[];
}
export interface ClassifyOutput {
  quadrant: "start_now" | "plan" | "reshape" | "park";
  tier: "tier_1" | "tier_2" | "tier_3";
}
export function classifyOutcome(input: ClassifyInput): ClassifyOutput {
  const T = SCORING_WEIGHTS.quadrant_threshold;
  const { priority, delivery_readiness, reason_codes } = input;

  let quadrant: ClassifyOutput["quadrant"];
  if (priority >= T && delivery_readiness >= T) quadrant = "start_now";
  else if (priority >= T && delivery_readiness < T) quadrant = "plan";
  else if (priority < T && delivery_readiness >= T) quadrant = "reshape";
  else quadrant = "park";

  const hasHardStop = reason_codes.some((c) => HARD_STOP_CODES.includes(c));
  const hasDesignConstraint = reason_codes.some((c) => DESIGN_CONSTRAINT_CODES.includes(c));

  let tier: ClassifyOutput["tier"];
  if (quadrant === "park" || hasHardStop) tier = "tier_3";
  else if (quadrant === "start_now" && !hasDesignConstraint) tier = "tier_1";
  else tier = "tier_2";

  return { quadrant, tier };
}

// ============================================================================
// Helpers
// ============================================================================
function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (!Array.isArray(v)) return "";
  return v
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const row = item as AnyObj;
        return str(row.step) || str(row.name) || str(row.label) || str(row.value);
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function rowObjects(v: unknown): AnyObj[] {
  return arr(v).filter((item): item is AnyObj => !!item && typeof item === "object");
}
function bool(v: unknown): boolean {
  return v === true || v === "true" || v === "yes";
}
/** Defensive clamp to [0, 100], handling NaN/Infinity. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
function mapOrMissing(value: string, map: Record<string, number>): number | null {
  if (!value) return null;
  return map[value] ?? null;
}

interface ComputeInput {
  block1: AnyObj;
  block2: AnyObj;
  block3: AnyObj;
  block4: AnyObj;
}

export interface ScoreResult {
  pillar_scores: {
    business_impact: number;
    feasibility: number;
    process_maturity: number;
    risk: number;
    ai_suitability: number;
    agent_suitability: number;
    delivery_readiness: number;
    priority: number;
  };
  delivery_readiness: number;
  priority: number;
  quadrant: "start_now" | "plan" | "reshape" | "park";
  tier: "tier_1" | "tier_2" | "tier_3";
  classification: "Automation" | "AI Assistant" | "AI Workflow" | "AI Agent" | "Not Ready";
  complexity_score: number;
  complexity_tag: "Simple" | "Moderate" | "Complex" | "Very Complex";
  reason_codes: string[];
  gate_statuses: Record<string, { status: "PASS" | "FAIL" | "NOT_ASSESSED"; checks: Record<string, boolean | "n/a"> }>;
  step_automation_map: Record<string, number>;
}

// ============================================================================
// computeScore — pure, deterministic, fully tested
// ============================================================================
export function computeScore({ block1, block2, block3, block4 }: ComputeInput): ScoreResult {
  const W = SCORING_WEIGHTS;
  const E = W.enums;
  const reason_codes: string[] = [];

  // ----- Block 1
  const successMetric = str(block1.success_metric).trim();
  const inScope = str(block1.in_scope).trim();
  const outScope = str(block1.out_of_scope).trim();
  const objectives = text(block1.business_objectives).trim();
  const shape = str(block1.use_case_shape);

  if (!successMetric) {
    reason_codes.push("NO_SUCCESS_METRIC");
    reason_codes.push("MISSING_SUCCESS_METRIC");
  }
  if (!inScope && !outScope) {
    reason_codes.push("SCOPE_UNDEFINED");
    reason_codes.push("MISSING_SCOPE");
  }

  // ----- Block 2
  const dataReadiness = str(block2.data_readiness);
  const accessibility = str(block2.accessibility);
  const structure = str(block2.structure);
  const classification = str(block2.classification);
  const historical = str(block2.historical_cases);
  const actionability = str(block2.actionability);
  const personalData = bool(block2.personal_data);
  const foreignVendor = bool(block2.foreign_vendor_access);

  if (!accessibility) reason_codes.push("MISSING_DATA_ACCESS");
  if (accessibility === "none") reason_codes.push("NO_DATA_ACCESS");
  if (accessibility === "manual") reason_codes.push("NO_API");
  if (!dataReadiness) reason_codes.push("MISSING_DATA_READINESS");
  if (dataReadiness === "missing" || dataReadiness === "poor") reason_codes.push("DATA_NOT_ACCESSIBLE");
  if (!structure) reason_codes.push("MISSING_STRUCTURE");
  if (historical === "no") reason_codes.push("NO_HISTORICAL_DATA");
  if (personalData) reason_codes.push("PII_PRESENT");
  if (foreignVendor) reason_codes.push("FOREIGN_DATA_ACCESS");

  // ----- Block 3
  const workflowRows = rowObjects(block3.workflow_steps);
  const steps = workflowRows.length
    ? workflowRows.map((row, index) => str(row.step).trim() || `step_${index + 1}`)
    : arr(block3.workflow_steps).map((s) => (typeof s === "string" ? s : "")).filter(Boolean);
  const stepAutomationRaw = block3.per_step_automation as AnyObj | undefined;
  const step_automation_map: Record<string, number> = {};
  let automationSum = 0;
  let maxAutomation = 0;
  steps.forEach((s, i) => {
    const key = s || `step_${i + 1}`;
    const lvl = num(workflowRows[i]?.automation ?? stepAutomationRaw?.[key] ?? stepAutomationRaw?.[String(i)], 0);
    step_automation_map[key] = lvl;
    automationSum += lvl;
    if (lvl > maxAutomation) maxAutomation = lvl;
  });
  const avgAutomation = steps.length ? automationSum / steps.length : 0;

  const hitl = str(block3.hitl_decisions);
  const decisionLogic = str(block3.decision_logic_type);
  const rulesDoc = str(block3.rules_documentation);
  const standardisation = str(block3.standardisation);
  const exceptionRate = num(block3.exception_rate, 0);
  const triggerType = str(block3.trigger_type);

  if (!hitl) reason_codes.push("MISSING_HITL");
  if (hitl === "mandatory") reason_codes.push("HITL_MANDATORY");
  if (exceptionRate >= W.high_exception_rate) reason_codes.push("HIGH_EXCEPTION_RATE");
  if (standardisation === "low") reason_codes.push("LOW_STANDARDIZATION");
  if (rulesDoc === "no") reason_codes.push("RULES_UNDOCUMENTED");
  if (triggerType === "manual") reason_codes.push("TRIGGER_MANUAL");

  // ----- Block 4
  const reversibility = str(block4.error_reversibility);
  const validation = str(block4.output_validation);
  const verifiable = str(block4.output_verifiable);
  const rollback = str(block4.rollback_path);
  const monitoring = str(block4.monitoring_plan);
  const owner = str(block4.process_owner).trim();
  const riskTolerance = str(block4.risk_tolerance);
  const outputCriticality = str(block4.output_criticality);

  if (!reversibility) reason_codes.push("MISSING_REVERSIBILITY");
  if (reversibility === "irreversible") reason_codes.push("IRREVERSIBLE_ERRORS");
  if (verifiable === "no") reason_codes.push("OUTPUT_NOT_VERIFIABLE");
  if (!rollback) reason_codes.push("MISSING_ROLLBACK_PATH");
  if (rollback === "no") reason_codes.push("NO_ROLLBACK_PATH");
  if (!monitoring) reason_codes.push("MISSING_MONITORING_PLAN");
  if (monitoring === "no") reason_codes.push("NO_MONITORING_PATH");
  if (!owner) {
    reason_codes.push("NO_PROCESS_OWNER");
    reason_codes.push("MISSING_PROCESS_OWNER");
  }
  if (!outputCriticality) reason_codes.push("MISSING_OUTPUT_CRITICALITY");

  // ----- STEP_AUTOMATION_UNSAFE
  const highCriticality = outputCriticality === "high" || outputCriticality === "critical";
  const irreversible = reversibility === "irreversible";
  if (
    maxAutomation >= W.unsafe_step_automation_level &&
    (irreversible || highCriticality) &&
    hitl !== "mandatory"
  ) {
    reason_codes.push("STEP_AUTOMATION_UNSAFE");
  }

  // ============================================================================
  // Pillars — every value clamped, missing inputs honestly lowered.
  // ============================================================================
  const objectivesScore = objectives ? E.objectives_present : E.objectives_missing;
  const metricScore = successMetric ? E.metric_present : E.metric_missing;
  const criticalityScore =
    mapOrMissing(outputCriticality, E.output_criticality) ?? E.missing_positive;
  const business_impact = clampScore((objectivesScore + metricScore + criticalityScore) / 3);

  const accessScore = mapOrMissing(accessibility, E.accessibility) ?? E.missing_positive;
  const readinessScore = mapOrMissing(dataReadiness, E.data_readiness) ?? E.missing_positive;
  const structureScore = mapOrMissing(structure, E.structure) ?? E.missing_positive;
  const feasibility = clampScore((accessScore + readinessScore + structureScore) / 3);

  const stdScore = mapOrMissing(standardisation, E.standardisation) ?? E.missing_positive;
  const rulesScore = mapOrMissing(rulesDoc, E.rules_documentation) ?? E.missing_positive;
  const exceptionScore = clampScore(100 - exceptionRate * 2);
  const ownerScore = owner ? E.owner_present : E.owner_missing;
  const process_maturity = clampScore((stdScore + rulesScore + exceptionScore + ownerScore) / 4);

  const reversibilityRisk =
    mapOrMissing(reversibility, E.reversibility_risk) ?? E.missing_risk;
  const piiRisk = personalData ? E.pii_risk_yes : E.pii_risk_no;
  const classRisk = mapOrMissing(classification, E.classification_risk) ?? E.missing_risk;
  const toleranceRisk = mapOrMissing(riskTolerance, E.risk_tolerance) ?? E.missing_risk;
  const risk = clampScore((reversibilityRisk + piiRisk + classRisk + toleranceRisk) / 4);

  const shapeAiFit = mapOrMissing(shape, E.shape_ai_fit) ?? E.missing_positive;
  const historicalFit = mapOrMissing(historical, E.historical_fit) ?? E.missing_positive;
  const ai_suitability = clampScore((structureScore + shapeAiFit + historicalFit) / 3);

  // ----- Agent suitability (broader, more explainable)
  const A = W.agent;
  let agent = A.base;
  if (steps.length >= 3) agent += A.multi_step_bonus;
  if (accessScore > 60) agent += A.good_access_bonus;
  else if (accessScore < 35) agent -= A.poor_access_penalty;
  if (triggerType === "event" || triggerType === "scheduled") agent += A.reliable_trigger_bonus;
  if (triggerType === "manual") agent -= A.manual_trigger_penalty;
  if (avgAutomation >= 3) agent += A.high_automation_bonus;
  if (hitl === "mandatory") agent -= A.hitl_mandatory_penalty;
  if (reversibility === "irreversible") agent -= A.irreversible_penalty;
  else if (reversibility === "hard") agent -= A.hard_to_reverse_penalty;
  if (actionability === "yes") agent += A.actionability_yes;
  else if (actionability === "no") agent -= A.actionability_no;
  if (rollback === "yes") agent += A.rollback_yes;
  else if (rollback === "no") agent -= A.rollback_no;
  if (monitoring === "yes") agent += A.monitoring_yes;
  else if (monitoring === "no") agent -= A.monitoring_no;
  const agent_suitability = clampScore(agent);

  const delivery_readiness = clampScore(
    W.delivery_readiness.process_maturity * process_maturity + W.delivery_readiness.feasibility * feasibility,
  );
  const priority = clampScore(
    W.priority.business_impact * business_impact +
      W.priority.delivery_readiness * delivery_readiness +
      W.priority.low_risk * (100 - risk),
  );

  // ----- Quadrant + Tier (delegated to pure helper for direct unit testing)
  const { quadrant, tier } = classifyOutcome({
    priority,
    delivery_readiness,
    reason_codes,
  });
  const complexity_score = clampScore(
    Math.min(steps.length, 10) * 6 +
      Math.min(exceptionRate, 50) +
      (decisionLogic === "judgment" ? 20 : decisionLogic === "mixed" ? 12 : 4) +
      (accessScore < 35 ? 12 : 0),
  );
  const complexity_tag: ScoreResult["complexity_tag"] =
    complexity_score <= 29 ? "Simple" :
    complexity_score <= 54 ? "Moderate" :
    complexity_score <= 74 ? "Complex" :
    "Very Complex";
  const classification: ScoreResult["classification"] =
    tier === "tier_3" && reason_codes.some((c) => HARD_STOP_CODES.includes(c)) ? "Not Ready" :
    agent_suitability >= 70 && ai_suitability >= 60 && avgAutomation >= 3 && risk < 75 ? "AI Agent" :
    ai_suitability >= 65 && steps.length >= 2 ? "AI Workflow" :
    ai_suitability >= 50 ? "AI Assistant" :
    "Automation";

  // ----- Gate statuses
  const g1 = {
    success_metric_defined: !!successMetric,
    scope_defined: !!(inScope && outScope),
    data_sources_identified: !!text(block2.primary_systems),
    hitl_decided: !!hitl,
  };
  const g2 = {
    validation_required: !!validation && validation !== "none",
    output_verifiable: verifiable === "yes" || verifiable === "partial",
    rollback_path_exists: rollback === "yes" || rollback === "partial",
    monitoring_plan_defined: monitoring === "yes" || monitoring === "partial",
    no_auto_approval_on_irreversible: !(reversibility === "irreversible" && hitl === "none"),
  };

  const gate_statuses: ScoreResult["gate_statuses"] = {
    gate_1: {
      status: Object.values(g1).every(Boolean) ? "PASS" : "FAIL",
      checks: g1 as Record<string, boolean>,
    },
    gate_2: {
      status: Object.values(g2).every(Boolean) ? "PASS" : "FAIL",
      checks: g2 as Record<string, boolean>,
    },
    gate_3: {
      status: "NOT_ASSESSED",
      checks: {
        pilot_evidence: "n/a",
        accuracy_evidence: "n/a",
        time_saved_evidence: "n/a",
        reviewer_load_evidence: "n/a",
        process_owner_named: !!owner,
        monitoring_active: "n/a",
      },
    },
  };

  // Suppress unused
  void decisionLogic;

  return {
    pillar_scores: {
      business_impact,
      feasibility,
      process_maturity,
      risk,
      ai_suitability,
      agent_suitability,
      delivery_readiness,
      priority,
    },
    delivery_readiness,
    priority,
    quadrant,
    tier,
    classification,
    complexity_score,
    complexity_tag,
    reason_codes: Array.from(new Set(reason_codes)),
    gate_statuses,
    step_automation_map,
  };
}

// ============================================================================
// explainScore — plain-English breakdown for the UI
// ============================================================================
export interface ScoreBreakdown {
  pillars: {
    key: string;
    label: string;
    score: number;
    inputs: string[];
  }[];
  formulas: {
    delivery_readiness: string;
    priority: string;
  };
  quadrantWhy: string;
  tierWhy: string;
}

export function explainScore(input: ComputeInput): { result: ScoreResult; breakdown: ScoreBreakdown } {
  const result = computeScore(input);
  const { block1, block2, block3, block4 } = input;
  const p = result.pillar_scores;

  const objectives = str(block1.business_objectives).trim();
  const successMetric = str(block1.success_metric).trim();
  const outputCriticality = str(block4.output_criticality) || "missing";

  const accessibility = str(block2.accessibility) || "missing";
  const dataReadiness = str(block2.data_readiness) || "missing";
  const structure = str(block2.structure) || "missing";

  const standardisation = str(block3.standardisation) || "missing";
  const rulesDoc = str(block3.rules_documentation) || "missing";
  const owner = str(block4.process_owner).trim();
  const exceptionRate = num(block3.exception_rate, 0);

  const reversibility = str(block4.error_reversibility) || "missing";
  const classification = str(block2.classification) || "missing";
  const riskTolerance = str(block4.risk_tolerance) || "missing";
  const personalData = bool(block2.personal_data);

  const shape = str(block1.use_case_shape) || "missing";
  const historical = str(block2.historical_cases) || "missing";

  const breakdown: ScoreBreakdown = {
    pillars: [
      {
        key: "business_impact",
        label: "Business impact",
        score: p.business_impact,
        inputs: [
          `Business objectives: ${objectives ? "provided" : "missing"}`,
          `Success metric: ${successMetric ? "defined" : "missing"}`,
          `Output criticality: ${outputCriticality}`,
        ],
      },
      {
        key: "feasibility",
        label: "Feasibility",
        score: p.feasibility,
        inputs: [
          `Accessibility: ${accessibility}`,
          `Data readiness: ${dataReadiness}`,
          `Data structure: ${structure}`,
        ],
      },
      {
        key: "process_maturity",
        label: "Process maturity",
        score: p.process_maturity,
        inputs: [
          `Standardisation: ${standardisation}`,
          `Rules documented: ${rulesDoc}`,
          `Exception rate: ${exceptionRate}%`,
          `Process owner: ${owner ? "named" : "missing"}`,
        ],
      },
      {
        key: "risk",
        label: "Risk",
        score: p.risk,
        inputs: [
          `Error reversibility: ${reversibility}`,
          `Personal data: ${personalData ? "yes" : "no"}`,
          `Data classification: ${classification}`,
          `Risk tolerance: ${riskTolerance}`,
        ],
      },
      {
        key: "ai_suitability",
        label: "AI suitability",
        score: p.ai_suitability,
        inputs: [
          `Use case shape: ${shape}`,
          `Historical cases: ${historical}`,
          `Data structure: ${structure}`,
        ],
      },
      {
        key: "agent_suitability",
        label: "Agent suitability",
        score: p.agent_suitability,
        inputs: [
          `Workflow steps: ${arr(block3.workflow_steps).length}`,
          `Trigger: ${str(block3.trigger_type) || "missing"}`,
          `HITL: ${str(block3.hitl_decisions) || "missing"}`,
          `Reversibility: ${reversibility}`,
          `Rollback / monitoring: ${str(block4.rollback_path) || "missing"} / ${str(block4.monitoring_plan) || "missing"}`,
        ],
      },
    ],
    formulas: {
      delivery_readiness: `Delivery readiness = ${SCORING_WEIGHTS.delivery_readiness.process_maturity} × process maturity (${p.process_maturity}) + ${SCORING_WEIGHTS.delivery_readiness.feasibility} × feasibility (${p.feasibility}) = ${result.delivery_readiness}.`,
      priority: `Priority = ${SCORING_WEIGHTS.priority.business_impact} × business impact (${p.business_impact}) + ${SCORING_WEIGHTS.priority.delivery_readiness} × delivery readiness (${result.delivery_readiness}) + ${SCORING_WEIGHTS.priority.low_risk} × (100 − risk ${p.risk}) = ${result.priority}.`,
    },
    quadrantWhy: quadrantExplanation(result),
    tierWhy: tierExplanation(result),
  };

  return { result, breakdown };
}

function quadrantExplanation(r: ScoreResult): string {
  const T = SCORING_WEIGHTS.quadrant_threshold;
  const pri = r.priority >= T ? `≥ ${T}` : `< ${T}`;
  const dr = r.delivery_readiness >= T ? `≥ ${T}` : `< ${T}`;
  return `Priority ${r.priority} (${pri}) and delivery readiness ${r.delivery_readiness} (${dr}) place this in "${r.quadrant.replace("_", " ")}".`;
}

function tierExplanation(r: ScoreResult): string {
  const hardStops = r.reason_codes.filter((c) => HARD_STOP_CODES.includes(c));
  const designConstraints = r.reason_codes.filter((c) => DESIGN_CONSTRAINT_CODES.includes(c));
  if (r.tier === "tier_3") {
    if (hardStops.length) return `Tier 3 — blocked by hard stops: ${hardStops.join(", ")}.`;
    return `Tier 3 — quadrant is "park" (low priority and low delivery readiness).`;
  }
  if (r.tier === "tier_1") {
    return `Tier 1 — quadrant is "start now" with no hard stops or design constraints.`;
  }
  // tier_2
  if (designConstraints.length) {
    return `Tier 2 — design constraints prevent Tier 1: ${designConstraints.join(", ")}.`;
  }
  return `Tier 2 — outside the "start now" quadrant or has watch items.`;
}

// ============================================================================
// Server function
// ============================================================================
const ScoreInput = z.object({
  use_case_id: z.string().uuid(),
});

export const scoreUseCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScoreInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };

    // ----- Server-side authorization (bypass RLS, check explicitly) -----
    const { data: uc, error: ucReadErr } = await supabaseAdmin
      .from("use_cases")
      .select("id, workspace_id, created_by, status")
      .eq("id", data.use_case_id)
      .maybeSingle();
    if (ucReadErr) throw new Error(ucReadErr.message);
    if (!uc) throw new Error("Use case not found");

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", uc.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!membership) throw new Error("Not a workspace member");

    const isAdmin = membership.role === "owner" || membership.role === "admin";
    const isCreator = uc.created_by === userId;
    if (!isAdmin && !isCreator) {
      throw new Error("Only the use case creator or a workspace admin can score this use case");
    }

    // ----- Read captures + compute -----
    const { data: captures, error: capErr } = await supabaseAdmin
      .from("use_case_captures")
      .select("block_number, responses")
      .eq("use_case_id", data.use_case_id);
    if (capErr) throw new Error(capErr.message);

    const byBlock: Record<number, AnyObj> = {};
    (captures ?? []).forEach((c) => {
      byBlock[c.block_number] = (c.responses ?? {}) as AnyObj;
    });

    const result = computeScore({
      block1: byBlock[1] ?? {},
      block2: byBlock[2] ?? {},
      block3: byBlock[3] ?? {},
      block4: byBlock[4] ?? {},
    });

    // ----- Persist via admin client (table is now write-locked from clients) -----
    const QUADRANT_MAP: Record<string, string> = {
      start_now: "quick-wins",
      plan: "strategic-projects",
      reshape: "tactical-improvements",
      park: "foundational-rebuilds",
    };
    const mappedQuadrant = result.quadrant
      ? (QUADRANT_MAP[result.quadrant] ?? result.quadrant)
      : null;
    const { error: upErr } = await supabaseAdmin
      .from("use_case_scores")
      .upsert(
        {
          use_case_id: data.use_case_id,
          pillar_scores: result.pillar_scores as Json,
          delivery_readiness: result.delivery_readiness,
          priority: result.priority,
          quadrant: mappedQuadrant,
          business_impact: result.pillar_scores.business_impact,
          feasibility: result.pillar_scores.feasibility,
          process_maturity: result.pillar_scores.process_maturity,
          risk: result.pillar_scores.risk,
          ai_suitability: result.pillar_scores.ai_suitability,
          agent_suitability: result.pillar_scores.agent_suitability,
          classification: result.classification,
          complexity_score: result.complexity_score,
          complexity_tag: result.complexity_tag,
          scoring_version: "2.2",
          reason_codes: result.reason_codes,
          gate_statuses: result.gate_statuses as Json,
          step_automation_map: result.step_automation_map as Json,
          scored_at: new Date().toISOString(),
          scored_by: userId,
        },
        { onConflict: "use_case_id" },
      );
    if (upErr) throw new Error(upErr.message);


    const { error: ucErr } = await supabaseAdmin
      .from("use_cases")
      .update({
        status: "scored",
        use_case_family: str(byBlock[1]?.use_case_family) || null,
        capture_v2: {
          block1: byBlock[1] ?? {},
          block2: byBlock[2] ?? {},
          block3: byBlock[3] ?? {},
          block4: byBlock[4] ?? {},
        } as Json,
        derived_scores: {
          ...result,
          quadrant: mappedQuadrant,
        } as Json,
        capture_version: "2.2",
      })
      .eq("id", data.use_case_id);
    if (ucErr) throw new Error(ucErr.message);

    return result;
  });
