#!/usr/bin/env bun
/**
 * Build output-key guard.
 *
 * Validates the current HOI Build architecture:
 * - capture route imports the real wizard schema dependency;
 * - wizard schema exposes the four canonical Build steps and scoring keys;
 * - final capture submission calls the server-side scoring function before approval;
 * - scoring persists V2 score columns plus use_cases.derived_scores;
 * - dashboard/scale use classification and do not read legacy tier.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const exists = (p: string) => existsSync(join(ROOT, p));

const WIZARD_SCHEMA = "src/lib/build/wizard-schema.ts";
const DASHBOARD_BUCKETS = "src/lib/build/dashboardBuckets.ts";
const SCORE_PATH = "src/lib/scoring.functions.ts";
const CAPTURE_ROUTE = "src/routes/app.$workspaceSlug.build.capture.$useCaseId.tsx";
const DASHBOARD_ROUTE = "src/routes/app.$workspaceSlug.build.dashboard.tsx";
const BUILD_INDEX_ROUTE = "src/routes/app.$workspaceSlug.build.index.tsx";
const SCALE_QUERIES = "src/lib/scale/queries.ts";

const REQUIRED_FILES = [
  WIZARD_SCHEMA,
  DASHBOARD_BUCKETS,
  SCORE_PATH,
  CAPTURE_ROUTE,
  DASHBOARD_ROUTE,
  BUILD_INDEX_ROUTE,
];

const errors: string[] = [];
for (const p of REQUIRED_FILES) {
  if (!exists(p)) errors.push(`missing required file: ${p}`);
}
if (errors.length > 0) {
  for (const e of errors) console.error("✗ " + e);
  process.exit(1);
}

const wizardSrc = read(WIZARD_SCHEMA);
const scoreSrc = stripComments(read(SCORE_PATH));
const captureSrc = stripComments(read(CAPTURE_ROUTE));
const dashboardSrc = stripComments(read(DASHBOARD_ROUTE));
const buildIndexSrc = stripComments(read(BUILD_INDEX_ROUTE));
const scaleSrc = exists(SCALE_QUERIES) ? stripComments(read(SCALE_QUERIES)) : "";

function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Capture route imports the dependency it actually uses.
if (!/@\/lib\/build\/wizard-schema/.test(captureSrc)) {
  errors.push(`${CAPTURE_ROUTE} must import "@/lib/build/wizard-schema"`);
}
if (!/scoreUseCase/.test(captureSrc)) {
  errors.push(`${CAPTURE_ROUTE} must call scoreUseCase before approval submission`);
}

// Wizard exports + four-step contract.
for (const exp of ["STEPS", "validateStep", "FieldDef", "StepDef", "WizardValues"]) {
  if (!new RegExp(`\\b${exp}\\b`).test(wizardSrc)) {
    errors.push(`${WIZARD_SCHEMA} must expose ${exp}`);
  }
}
for (const title of ["Strategic Intent", "Data & System", "Process Shape", "Governance"]) {
  if (!wizardSrc.includes(title)) errors.push(`${WIZARD_SCHEMA} missing step "${title}"`);
}
const REQUIRED_SCORING_KEYS = [
  "success_metric",
  "in_scope",
  "out_of_scope",
  "business_objectives",
  "use_case_shape",
  "primary_systems",
  "data_readiness",
  "accessibility",
  "structure",
  "classification",
  "historical_cases",
  "actionability",
  "personal_data",
  "foreign_vendor_access",
  "workflow_steps",
  "hitl_decisions",
  "decision_logic_type",
  "rules_documentation",
  "standardisation",
  "exception_rate",
  "trigger_type",
  "error_reversibility",
  "output_validation",
  "output_verifiable",
  "rollback_path",
  "monitoring_plan",
  "process_owner",
  "risk_tolerance",
  "output_criticality",
];
for (const key of REQUIRED_SCORING_KEYS) {
  if (!new RegExp(`["']${key}["']`).test(wizardSrc)) {
    errors.push(`${WIZARD_SCHEMA} missing scoring key "${key}"`);
  }
}

// Scoring persistence: V2 columns + derived score snapshot.
const REQUIRED_V2_FIELDS = [
  "business_impact",
  "feasibility",
  "process_maturity",
  "risk",
  "ai_suitability",
  "agent_suitability",
  "classification",
  "complexity_score",
  "complexity_tag",
  "scoring_version",
];
for (const field of REQUIRED_V2_FIELDS) {
  if (!new RegExp(`\\b${field}\\b`).test(scoreSrc)) {
    errors.push(`${SCORE_PATH} does not write V2 field "${field}"`);
  }
}
if (!/from\(\s*["']use_case_scores["']\s*\)[\s\S]{0,120}\.upsert\(/.test(scoreSrc)) {
  errors.push(`${SCORE_PATH} must upsert into use_case_scores`);
}
if (!/derived_scores\s*:/.test(scoreSrc)) {
  errors.push(`${SCORE_PATH} must populate use_cases.derived_scores`);
}

// Dashboard/index should use quadrant/classification correctly.
if (/\btier\b/.test(dashboardSrc)) {
  errors.push(`${DASHBOARD_ROUTE} still references legacy tier`);
}
if (!/\bclassification\b/.test(dashboardSrc)) {
  errors.push(`${DASHBOARD_ROUTE} must reference classification`);
}
if (/classification\s*===\s*["']quick-wins["']/.test(buildIndexSrc)) {
  errors.push(`${BUILD_INDEX_ROUTE} counts quick wins from classification instead of quadrant`);
}

if (scaleSrc) {
  const selectMatch = scaleSrc.match(/use_case_scores\s*\(([^)]*)\)/);
  if (selectMatch) {
    const cols = selectMatch[1];
    if (!/\bclassification\b/.test(cols)) {
      errors.push(`${SCALE_QUERIES}: use_case_scores select must include classification`);
    }
    if (/\btier\b/.test(cols)) {
      errors.push(`${SCALE_QUERIES}: use_case_scores select still references tier`);
    }
  }
}

if (errors.length === 0) {
  console.log("✓ build output-key check passed");
  console.log(`  validated schema:  ${WIZARD_SCHEMA}`);
  console.log(`  validated scoring: ${SCORE_PATH} (${REQUIRED_V2_FIELDS.length} V2 fields)`);
  console.log("  validated routes:  capture, dashboard, overview");
  process.exit(0);
}

console.error("✗ build output-key check FAILED");
for (const e of errors) console.error("  - " + e);
process.exit(1);
