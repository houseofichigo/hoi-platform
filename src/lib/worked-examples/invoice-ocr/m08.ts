// src/lib/worked-examples/invoice-ocr/m08.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type ArchitectureChoiceId = "hosting" | "model" | "orchestration" | "storage";
export type CostCategoryId =
  | "tokens"
  | "ocr_api"
  | "infrastructure"
  | "licensing"
  | "human_review";

export interface ArchitectureChoice {
  id: ArchitectureChoiceId;
  label: string;
  options: readonly string[];
  recommendedDefault: string;
  decisionQuestion: string;
}

export interface SecurityRisk {
  id: string;
  title: string;
  threat: string;
  mitigation: string;
  evidence: string;
}

export interface CostCategory {
  id: CostCategoryId;
  label: string;
  driver: string;
  estimationMethod: string;
}

export interface DeploymentPlanScaffold {
  architecture: string;
  dataFlow: string;
  securityRisks: string;
  costModel: string;
  rollback: string;
  partnerHandoff: string;
}

export interface PlanSection {
  id: keyof DeploymentPlanScaffold;
  title: string;
  prompt: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M08_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "Deployment planning is where a pilot becomes accountable: architecture, data, security, cost, rollback.",

  step1: {
    title: "Architecture choices",
    why: "Before writing the plan, lock four architecture choices. Each one has consequences that are hard to reverse once partners build against them.",
    example:
      "Hosting (managed cloud vs self-hosted), model (managed API vs open weights), orchestration (managed agent runtime vs custom), storage (managed DB + object store vs self-managed).",
    whatToNotice: [
      "Each choice has a default — defaults are decisions, not the absence of one",
      "Self-hosting reduces residency risk but raises operational cost",
      "Managed orchestration shortens delivery; custom widens audit and control",
    ],
    produces: "Four architecture choices with a written rationale",
    nextLabel: "Step 2 — security risks",
  },

  step2: {
    title: "Security & data-flow risks",
    why: "A deployment plan that does not name its top risks is marketing. Pick the three risks most likely to land first and write mitigations partners can implement.",
    example:
      "Webhook spoofing on integration callbacks. PII leakage through prompts or logs. Schema drift in the accounting API. Secret exposure in shared environments. Audit gaps when a tool call fails silently.",
    whatToNotice: [
      "A mitigation is a control someone can implement and verify",
      "Each risk needs evidence the mitigation actually works",
      "Three is the limit on purpose — pick the ones you would defend first",
    ],
    produces: "Top three security risks with mitigations and evidence",
    nextLabel: "Step 3 — cost model",
  },

  step3: {
    title: "Cost model",
    why: "If you cannot estimate monthly spend, you cannot defend the plan. Cost lives across LLM tokens, OCR/API calls, infrastructure, licensing, and human review time.",
    example:
      "Tokens: prompt + completion × invoices/month. OCR API: pages × per-page price. Infrastructure: compute + storage + egress. Licensing: tooling + monitoring + support. Human review: minutes per HITL × hourly cost.",
    whatToNotice: [
      "Unit cost × volume is the floor — add buffer for retries and re-runs",
      "Human-review time is real cost — not a free externality",
      "Cost grows non-linearly with HITL rate and exception rate",
    ],
    produces: "Monthly cost estimate by category, with notes on drivers",
    nextLabel: "Step 4 — integration plan",
  },

  step4: {
    title: "Integration plan & rollback",
    why: "A one-to-two page plan that partners can implement: architecture, data flow, risks, cost, rollback, handoff. If it cannot fit on two pages, it is not a plan, it is a wish.",
    example:
      "Each section is short, dated, and explicit about ownership. The rollback section names a single owner, a reversal path, and a kill switch.",
    whatToNotice: [
      "A rollback without a named owner is not a rollback",
      "Partner handoff lists deliverables and acceptance criteria",
      "Every section answers 'who is accountable when this breaks?'",
    ],
    produces: "A 1-2 page Integration & Deployment Plan ready for partners",
  },

  architectureChoices: [
    {
      id: "hosting",
      label: "Hosting",
      options: ["Managed cloud (vendor region-pinned)", "Self-hosted in our cloud account", "On-premise / private datacenter"],
      recommendedDefault: "Managed cloud (vendor region-pinned)",
      decisionQuestion: "Where do invoice files, extractions, and audit events live at rest?",
    },
    {
      id: "model",
      label: "Model",
      options: ["Managed model API (no-train clause)", "Open-weights model on our infra", "Hybrid: managed for OCR, open for validation"],
      recommendedDefault: "Managed model API (no-train clause)",
      decisionQuestion: "What model serves extraction and validation, and under what training terms?",
    },
    {
      id: "orchestration",
      label: "Orchestration",
      options: ["Managed agent runtime", "Custom orchestration (in our app)", "Workflow tool (n8n / Power Automate / Zapier)"],
      recommendedDefault: "Managed agent runtime",
      decisionQuestion: "What runtime executes the workflow and enforces tool boundaries?",
    },
    {
      id: "storage",
      label: "Storage & audit",
      options: ["Managed DB + object store + log service", "Self-managed Postgres + S3-compatible store", "Mixed: managed audit, self-hosted documents"],
      recommendedDefault: "Managed DB + object store + log service",
      decisionQuestion: "Where do documents, structured data, and the audit trail live, and who can read them?",
    },
  ] as const satisfies readonly ArchitectureChoice[],

  securityRisks: [
    {
      id: "webhook_spoofing",
      title: "Webhook spoofing",
      threat: "An attacker forges callbacks from the accounting system or notification channel and triggers writes or HITL bypass.",
      mitigation: "HMAC-signed webhooks with rotated secrets, timestamp window, and request replay protection.",
      evidence: "Signed test vector + rejected unsigned request in logs.",
    },
    {
      id: "pii_leakage",
      title: "PII leakage",
      threat: "Supplier and personal data leaks via prompts, log lines, or analytics events to systems without DPA coverage.",
      mitigation: "PII scrubber on prompts and logs; allowlist of fields sent to the model; opt-out training clause in DPA.",
      evidence: "Sample redacted log + DPA clause reference + scrubber unit tests.",
    },
    {
      id: "schema_drift",
      title: "Schema drift in accounting API",
      threat: "Vendor changes the accounting API; sync silently breaks or posts malformed records.",
      mitigation: "Contract tests on every release; schema version pin; alarm on validation failure rate spike.",
      evidence: "CI contract test report + alerting rule + last-30-days drift incidents.",
    },
    {
      id: "secret_exposure",
      title: "Secret exposure",
      threat: "API keys for the model, accounting system, or storage leak via repo, env dumps, or shared logs.",
      mitigation: "Centralized secret store, short-lived tokens, scoped service accounts, secret scanning in CI.",
      evidence: "Secret store inventory + CI scanner config + rotation log.",
    },
    {
      id: "audit_gaps",
      title: "Audit gaps",
      threat: "A failed tool call or skipped HITL leaves no record; the audit trail cannot reconstruct what happened.",
      mitigation: "Append events for both success and failure paths; daily integrity check; append-only storage.",
      evidence: "Failure-path event sample + integrity job report + retention policy.",
    },
  ] as const satisfies readonly SecurityRisk[],

  costCategories: [
    {
      id: "tokens",
      label: "LLM tokens",
      driver: "Prompt + completion tokens per invoice × invoices/month × retries.",
      estimationMethod: "Measure tokens on a representative batch; multiply by expected volume and 1.2x retry buffer.",
    },
    {
      id: "ocr_api",
      label: "OCR / extraction API",
      driver: "Pages or documents × per-page price.",
      estimationMethod: "Average pages per invoice × invoices/month × vendor price.",
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      driver: "Compute, storage, egress, queueing for the orchestration runtime.",
      estimationMethod: "Baseline + per-invoice marginal; include backup and DR storage.",
    },
    {
      id: "licensing",
      label: "Licensing & tools",
      driver: "Agent platform seats, monitoring, vendor support, dev tooling.",
      estimationMethod: "Per-seat × users + flat platform fees + support tier.",
    },
    {
      id: "human_review",
      label: "Human review",
      driver: "HITL minutes per invoice × hourly fully-loaded reviewer cost.",
      estimationMethod: "Reviewer minutes/invoice × HITL rate × invoices/month × hourly cost.",
    },
  ] as const satisfies readonly CostCategory[],

  planSections: [
    { id: "architecture", title: "Architecture", prompt: "Hosting, model, orchestration, storage — chosen options and rationale." },
    { id: "dataFlow", title: "Data flow", prompt: "Where data enters, transits, is stored, leaves, and is deleted. Name each system." },
    { id: "securityRisks", title: "Security risks", prompt: "Top three risks, mitigations, and how they will be verified." },
    { id: "costModel", title: "Cost model", prompt: "Monthly estimate by category with stated assumptions." },
    { id: "rollback", title: "Rollback", prompt: "Reversal path, kill switch, and the single owner who can execute it." },
    { id: "partnerHandoff", title: "Partner handoff", prompt: "Deliverables, acceptance criteria, owners, and review cadence." },
  ] as const satisfies readonly PlanSection[],

  methodNote:
    "A deployment plan partners can execute is a contract with operations. Two pages, dated, with a named owner per section.",
} as const;

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM08DeploymentPlanScaffold(
  ctx: InvoiceOcrProfileContext,
): DeploymentPlanScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const architecture =
    `Hosting: managed cloud, region-pinned to ${country}. ` +
    `Model: managed API with a signed no-training clause covering ${company} data. ` +
    `Orchestration: managed agent runtime with scoped tools and per-call logging. ` +
    `Storage: managed DB + object store + append-only audit log under the ${company} tenant.`;

  const dataFlow =
    `1. Capture: supplier invoice enters object storage via the M05 prototype.\n` +
    `2. Extract: orchestration runtime calls the OCR/LLM tools; only allowlisted fields are sent.\n` +
    `3. Validate: KB01/KB02 rules apply locally; PII is scrubbed before any log line is emitted.\n` +
    `4. Sync: on approval, the agent writes a draft to ${accounting} with a reversal handle.\n` +
    `5. Audit: every step is appended to the audit log retained per ${country} policy.\n` +
    `6. Delete: source invoices and prompts are deleted on the retention schedule; audit events are kept.`;

  const securityRisks =
    `Top three risks for ${company} (${vat}):\n` +
    `1. Webhook spoofing on integration callbacks — HMAC signatures + replay protection.\n` +
    `2. PII leakage via prompts and logs — field allowlist + scrubber + DPA opt-out.\n` +
    `3. Audit gaps on failure paths — events on both success and failure + daily integrity job.`;

  const costModel =
    `Estimate built on ${volume} for ${company}: LLM tokens (prompt + completion × invoices/month × ` +
    `1.2 retry buffer); OCR/API (pages × per-page price); infrastructure (baseline + per-invoice ` +
    `marginal); licensing (platform + monitoring + support); human review (HITL minutes × hourly ` +
    `cost). Numbers reviewed monthly against actuals.`;

  const rollback =
    `Single named owner (AP lead) holds the kill switch. Reversal path: revoke service-account ` +
    `credentials, pause the orchestration runtime, and use the reversal handle on ${accounting} ` +
    `to undo any posted draft. Communication plan: notify Finance + IT within 30 minutes. ` +
    `Quarterly rollback drill against ${accounting} sandbox.`;

  const partnerHandoff =
    `Deliverables for the deployment partner: deployed environment in ${country}, integration ` +
    `with ${accounting} (draft + post-on-approval + reversal), monitoring dashboards, runbook, ` +
    `and the signed ADR from M07. Acceptance criteria: signed webhooks verified, PII scrubber ` +
    `tests passing, audit integrity job green for two consecutive weeks, cost dashboard live, ` +
    `rollback drill executed end-to-end. Review cadence: weekly during pilot, then monthly.`;

  return { architecture, dataFlow, securityRisks, costModel, rollback, partnerHandoff };
}
