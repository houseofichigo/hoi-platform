// src/lib/worked-examples/invoice-ocr/m07.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type ToolCriterionId =
  | "capability"
  | "cost"
  | "residency"
  | "training"
  | "mcp"
  | "audit"
  | "compliance"
  | "stability";

export type StackDecision = "keep" | "replace" | "constrain";

export interface ToolCriterion {
  id: ToolCriterionId;
  label: string;
  question: string;
  productionRisk: string;
  evidenceToCollect: string;
}

export interface StackLayer {
  id: string;
  label: string;
  pilotExample: string;
  productionQuestion: string;
}

export interface ADRSection {
  id: string;
  title: string;
  prompt: string;
}

export interface ToolDecisionScaffold {
  context: string;
  options: string;
  decision: string;
  rationale: string;
  consequences: string;
  reviewPlan: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M07_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "The pilot proved what can work. M07 decides what should survive production governance.",

  step1: {
    title: "Pilot stack inventory",
    why: "Before judging the stack, name every layer the agent depends on. A tool you forgot to inventory is a tool you cannot govern.",
    example:
      "Assistant layer (the grounded LLM + RAG). Prototype layer (the no-code surfaces). Agent orchestration (the runtime that calls tools). Accounting system (the external system of record). Monitoring (logs, traces, audit trail).",
    whatToNotice: [
      "Every layer has a vendor — even when it feels invisible",
      "A gap is a layer where the production answer is 'unknown'",
      "The accounting system is rarely up for replacement — the rest is",
    ],
    produces: "Stack inventory with a named tool and gap for all five layers",
    nextLabel: "Step 2 — governance comparison",
  },

  step2: {
    title: "Governance comparison matrix",
    why: "Production governance is multidimensional. Score two real options across the eight criteria so the trade-offs are visible and arguable.",
    example:
      "Pilot stack vs an alternative. Score each criterion 1-5 and capture evidence (a docs link, a contract clause, a vendor statement). A score with no evidence is an opinion.",
    whatToNotice: [
      "Residency and training opt-out are contractual, not marketing",
      "Audit logs need to be exportable, not just visible",
      "Vendor stability includes funding, roadmap, and incident history",
    ],
    produces: "Two-platform comparison matrix with evidence notes",
    nextLabel: "Step 3 — write the ADR",
  },

  step3: {
    title: "Tool Selection ADR",
    why: "An ADR forces you to write down the decision so it survives the people who made it. It also exposes weak rationale before it ships.",
    example:
      "Six sections: context, options considered, decision, rationale, consequences (good and bad), review plan. Short, dated, signed.",
    whatToNotice: [
      "Consequences include the bad ones — that is the point",
      "A decision without a review date is permanent by accident",
      "Options must include the option you rejected and why",
    ],
    produces: "A complete ADR ready to attach to the operating plan",
    nextLabel: "Step 4 — keep / replace / constrain",
  },

  step4: {
    title: "Pilot-to-production stack decision",
    why: "Three honest endings: keep the pilot stack as-is, replace it for production, or keep it with named constraints. Anything else is wishful.",
    example:
      "Keep — the stack clears every governance criterion. Replace — at least one criterion fails and the gap cannot be closed contractually. Constrain — the stack is acceptable only for a bounded use, with explicit guardrails.",
    whatToNotice: [
      "'Constrain' is the most common honest answer",
      "Constraints must be enforceable, not aspirational",
      "Replace decisions name the replacement and the migration owner",
    ],
    produces: "A signed stack decision: keep, replace, or constrain — with justification",
  },

  stackLayers: [
    {
      id: "assistant",
      label: "Assistant (grounded LLM + RAG)",
      pilotExample: "Lovable AI Gateway model + knowledge base from M04.",
      productionQuestion: "Is the model + RAG provider contractually safe to feed real supplier data?",
    },
    {
      id: "prototype",
      label: "Prototype surfaces",
      pilotExample: "No-code workflow surfaces from M05 (upload, review, approve, audit).",
      productionQuestion: "Can the prototype host real users, real auth, and real audit — or is it strictly a sandbox?",
    },
    {
      id: "agent_orchestration",
      label: "Agent orchestration",
      pilotExample: "The runtime designed in M06 that runs the workflow and calls tools.",
      productionQuestion: "Does the orchestration platform support scoped tools, retries, and full step-level logging?",
    },
    {
      id: "accounting_system",
      label: "Accounting system (system of record)",
      pilotExample: "The accounting software the AP team already uses.",
      productionQuestion: "Does its API support draft + post-on-approval + reversal, and is access scoped per service account?",
    },
    {
      id: "monitoring",
      label: "Monitoring & audit",
      pilotExample: "Application logs + the audit log built in M06.",
      productionQuestion: "Are logs exportable, tamper-evident, and retained long enough to defend an audit?",
    },
  ] as const satisfies readonly StackLayer[],

  criteria: [
    {
      id: "capability",
      label: "Capability",
      question: "Does the tool do the job at the quality and scale we need?",
      productionRisk: "A capable demo can still miss long-context, multi-tool, or multilingual production cases.",
      evidenceToCollect: "Benchmark results on representative invoices + a stress test at expected volume.",
    },
    {
      id: "cost",
      label: "Cost",
      question: "Is the total cost (usage + ops + change cost) acceptable at production volume?",
      productionRisk: "Per-call pricing that is fine at pilot can become structurally unaffordable at volume.",
      evidenceToCollect: "Cost model at expected and 3x expected volume, including egress and storage.",
    },
    {
      id: "residency",
      label: "Data residency",
      question: "Where is the data processed and stored, and is that location contractually guaranteed?",
      productionRisk: "A vendor that 'usually' processes in-region can fail GDPR or sector residency rules.",
      evidenceToCollect: "DPA clause + region pinning configuration + sub-processor list.",
    },
    {
      id: "training",
      label: "Training opt-out",
      question: "Is our data excluded from vendor model training by contract?",
      productionRisk: "Defaults often allow training; supplier and invoice data leaking into a foundation model is not recoverable.",
      evidenceToCollect: "Signed opt-out / no-training clause and the API setting that enforces it.",
    },
    {
      id: "mcp",
      label: "MCP / tool support",
      question: "Does the platform support scoped, schemaed tools with per-call permissions and logs?",
      productionRisk: "An agent without MCP-grade tool boundaries is one prompt away from an unsafe action.",
      evidenceToCollect: "Tool schema example + per-call permission + per-call log sample.",
    },
    {
      id: "audit",
      label: "Audit logs",
      question: "Are step-level logs available, exportable, and tamper-evident?",
      productionRisk: "Logs that only live in a vendor UI cannot be used in an audit or incident review.",
      evidenceToCollect: "Sample exported log + retention policy + integrity mechanism.",
    },
    {
      id: "compliance",
      label: "Compliance",
      question: "Does the vendor hold the certifications our context requires (SOC2, ISO 27001, GDPR, sector-specific)?",
      productionRisk: "Marketing pages list certifications; only signed reports and scoped attestations count.",
      evidenceToCollect: "Current SOC2 report or ISO 27001 cert + GDPR DPA + sector addendum if applicable.",
    },
    {
      id: "stability",
      label: "Vendor stability",
      question: "Can we depend on this vendor for 12-24 months without forced migration?",
      productionRisk: "Pricing changes, deprecations, and acquisitions can void the decision before the next review.",
      evidenceToCollect: "Funding/ownership status + deprecation policy + incident history.",
    },
  ] as const satisfies readonly ToolCriterion[],

  adrSections: [
    { id: "context", title: "Context", prompt: "What problem and constraints are we deciding for? Include the pilot result." },
    { id: "options", title: "Options considered", prompt: "Name at least two real options with their key trade-offs." },
    { id: "decision", title: "Decision", prompt: "State the chosen option in one sentence. No hedging." },
    { id: "rationale", title: "Rationale", prompt: "Why this option won — tied to the eight governance criteria." },
    { id: "consequences", title: "Consequences", prompt: "Good and bad consequences. Name the bad ones explicitly." },
    { id: "review", title: "Review plan", prompt: "When and on what evidence will this decision be re-examined?" },
  ] as const satisfies readonly ADRSection[],

  decisionOptions: [
    {
      id: "keep" as const,
      label: "Keep",
      summary: "The pilot stack clears every governance criterion. Move it to production as-is.",
    },
    {
      id: "replace" as const,
      label: "Replace",
      summary: "At least one criterion fails and cannot be closed contractually. Migrate to the alternative.",
    },
    {
      id: "constrain" as const,
      label: "Constrain",
      summary: "Keep the stack but only inside named guardrails (volume, data class, region, integrations).",
    },
  ] as const,

  methodNote:
    "Tool selection is the moment governance becomes concrete. Pick on evidence, write the ADR, and set the review date before you ship.",
} as const;

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM07ToolDecisionScaffold(
  ctx: InvoiceOcrProfileContext,
): ToolDecisionScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const context =
    `At ${company} we ran an invoice OCR pilot (${volume}) in ${country} under ${vat}. ` +
    `The stack covers an assistant + RAG, a no-code prototype, an agent orchestration runtime, ` +
    `${accounting} as the system of record, and a monitoring/audit layer. We now need to decide ` +
    `whether this stack is acceptable to take into production governance.`;

  const options =
    `Option A — Keep the pilot stack as the production stack.\n` +
    `Option B — Replace one or more layers with an alternative vendor that better satisfies ` +
    `residency, training opt-out, or audit requirements for ${country}.\n` +
    `Option C — Keep the stack but constrain it (bounded volume, data class, or region) ` +
    `with enforceable guardrails.`;

  const decision =
    `We will [keep / replace / constrain] the pilot stack for invoice OCR at ${company}.`;

  const rationale =
    `Scored against the eight governance criteria (capability, cost, residency, training opt-out, ` +
    `MCP/tool support, audit logs, compliance, vendor stability), the chosen option best matches ` +
    `our obligations in ${country} (${vat}) and our integration with ${accounting} at ${volume}. ` +
    `Evidence is recorded in the comparison matrix.`;

  const consequences =
    `Good: a defensible stack with documented residency, training opt-out, and exportable audit ` +
    `logs. Bad: cost grows with volume; one vendor remains a single point of failure; integration ` +
    `with ${accounting} requires a named service account and reversal path; some edge VAT cases ` +
    `in ${country} still need human review.`;

  const reviewPlan =
    `Re-examine in 6 months or sooner if: pilot exits to wider rollout at ${company}, vendor ` +
    `deprecates a key capability, a residency/compliance change affects ${country}, or invoice ` +
    `volume exceeds 2x ${volume}.`;

  return { context, options, decision, rationale, consequences, reviewPlan };
}
