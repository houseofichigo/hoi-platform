// src/lib/worked-examples/invoice-ocr/m09.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type PillarId =
  | "impact"
  | "feasibility"
  | "process"
  | "risk"
  | "ai"
  | "agent"
  | "readiness"
  | "priority";

export type AutomationLevel = "manual" | "assist" | "automate" | "forbidden";

export type PortfolioDecision = "fund" | "fund_with_constraints" | "defer" | "stop";

export interface ScoringPillar {
  id: PillarId;
  label: string;
  question: string;
  highScoreSignal: string;
  lowScoreSignal: string;
}

export interface ReasonCode {
  id: string;
  label: string;
  meaning: string;
}

export interface CandidateTemplate {
  id: string;
  name: string;
  description: string;
  defaultReasonCodes: readonly string[];
}

export interface AutomationStepTemplate {
  id: string;
  label: string;
  recommendedLevel: AutomationLevel;
  humanControl: string;
}

export interface PortfolioScaffold {
  workedExampleName: string;
  candidatePrompts: string;
  scoringGuidance: string;
  gate3Dossier: string;
}

export interface DecisionOption {
  id: PortfolioDecision;
  label: string;
  summary: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M09_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "Gate 3 is where enthusiasm meets capital allocation. The question is not can we build it, but should this portfolio get the next investment cycle?",

  step1: {
    title: "Capture the portfolio",
    why: "Scoring without a portfolio is theatre. Capture the worked example plus three real candidates with a named owner before any number is assigned.",
    example:
      "Worked example: invoice OCR. Candidates: expense report triage, supplier risk screening, contract clause extraction. Each gets a name, a one-sentence description, and a single named owner.",
    whatToNotice: [
      "Owners are people, not teams",
      "Descriptions answer what + for whom in one sentence",
      "A candidate without an owner cannot be funded",
    ],
    produces: "Four named candidates with owner and description",
    nextLabel: "Step 2 — eight-pillar scoring",
  },

  step2: {
    title: "Eight-pillar scoring",
    why: "The engine forces a comparable score across all candidates. Reason codes prevent a high score from hiding a blocker.",
    example:
      "Score each pillar 1-5: business impact, feasibility, process maturity, risk, AI suitability, agent suitability, delivery readiness, priority. Attach reason codes to surface what the number is hiding.",
    whatToNotice: [
      "A high impact with low feasibility is a constraint, not a win",
      "Reason codes name blockers in vocabulary the gate accepts",
      "A reason code with no score is an opinion; a score with no reason code is a guess",
    ],
    produces: "Scores across eight pillars plus reason codes per candidate",
    nextLabel: "Step 3 — automation maps",
  },

  step3: {
    title: "Step-level automation map",
    why: "Scores compare candidates. Automation maps show where the human stays in control. They are how Gate 3 sees the workflow, not just the headline.",
    example:
      "Six steps per candidate. Mark each as manual, assisted, automated, or forbidden. Name the human control for assisted/automated steps.",
    whatToNotice: [
      "'Forbidden' is a valid level — some steps must never be automated",
      "Every automated step needs a named human control",
      "Maps make the HITL story concrete instead of aspirational",
    ],
    produces: "An automation map for each of the four candidates",
    nextLabel: "Step 4 — portfolio ranking",
  },

  step4: {
    title: "Portfolio ranking and constraints",
    why: "Ranking forces trade-offs. Constraints make the rank defensible — they say 'we will fund this only if these conditions hold'.",
    example:
      "Rank 1-4 (unique). Top rank is the next investment. Each candidate carries constraints: residency, HITL, monitoring, ownership, rollback.",
    whatToNotice: [
      "Average score informs rank but does not decide it — judgement does",
      "Constraints turn a 'yes' into a 'yes-if'",
      "A tied rank is not a rank",
    ],
    produces: "A ranked portfolio with constraints per candidate",
    nextLabel: "Step 5 — Gate 3 dossier",
  },

  step5: {
    title: "Gate 3 investment dossier",
    why: "Gate 3 is the third explicit decision: which use cases earn the next investment cycle? The dossier synthesises scores, reason codes, automation posture, and constraints into one decision document.",
    example:
      "The dossier names portfolio value, data readiness, governance readiness, monitoring path, ownership, investment fit, risk acceptance, and rollback. Each one becomes a Gate 3 criterion.",
    whatToNotice: [
      "Investment fit is judgement plus evidence, not vibes",
      "Risk acceptance must be named, not assumed",
      "A dossier that cannot fit on two pages is not a dossier",
    ],
    produces: "Gate 3 dossier ready for the gate route",
  },

  pillars: [
    {
      id: "impact",
      label: "Business Impact",
      question: "How much value does this create, and for whom — measurable in money, time, or risk?",
      highScoreSignal: "Quantified $ or hours saved, with a named beneficiary.",
      lowScoreSignal: "Generic 'efficiency' claim, no number, no beneficiary.",
    },
    {
      id: "feasibility",
      label: "Feasibility",
      question: "Can we build and operate this with current tools, data, and skills?",
      highScoreSignal: "Stack proven on similar work; team has done it before.",
      lowScoreSignal: "Requires capabilities we do not have and cannot acquire in the window.",
    },
    {
      id: "process",
      label: "Process Maturity",
      question: "Is the underlying process documented, stable, and measured?",
      highScoreSignal: "Written SOP, clear inputs/outputs, KPI history.",
      lowScoreSignal: "Tribal knowledge, frequent exceptions, no metrics.",
    },
    {
      id: "risk",
      label: "Risk",
      question: "What is the worst credible outcome and how is it contained?",
      highScoreSignal: "Reversible errors, bounded blast radius, named controls.",
      lowScoreSignal: "Irreversible errors, regulated data, no monitoring.",
    },
    {
      id: "ai",
      label: "AI Suitability",
      question: "Is this a problem AI is genuinely good at — language, perception, pattern recognition?",
      highScoreSignal: "Pattern-heavy, language- or vision-driven, tolerant of probabilistic output.",
      lowScoreSignal: "Requires deterministic correctness or unaudited reasoning.",
    },
    {
      id: "agent",
      label: "Agent Suitability",
      question: "Does this benefit from multi-step action with tools, or is it a single answer?",
      highScoreSignal: "Multi-step workflow with bounded tools and explicit HITL.",
      lowScoreSignal: "One-shot answer that does not need orchestration.",
    },
    {
      id: "readiness",
      label: "Delivery Readiness",
      question: "Do we have an owner, budget, deployment partner, and rollback path?",
      highScoreSignal: "Named owner, allocated budget, ready partner, working rollback.",
      lowScoreSignal: "No single owner, no budget, no partner identified.",
    },
    {
      id: "priority",
      label: "Priority",
      question: "Why this candidate, this cycle, ahead of the others?",
      highScoreSignal: "Strategic alignment, time-bound trigger, dependency unblocked.",
      lowScoreSignal: "Nice to have, no urgency, no dependency relief.",
    },
  ] as const satisfies readonly ScoringPillar[],

  reasonCodes: [
    {
      id: "HITL_MANDATORY",
      label: "HITL mandatory",
      meaning: "A required checkpoint must remain manual for legal, safety, or policy reasons.",
    },
    {
      id: "IRREVERSIBLE_ERRORS",
      label: "Irreversible errors",
      meaning: "A wrong action cannot be undone (payment release, public communication, deletion).",
    },
    {
      id: "NO_MONITORING_PATH",
      label: "No monitoring path",
      meaning: "We cannot currently observe or alert on the system's behavior in production.",
    },
    {
      id: "DATA_RESIDENCY_RISK",
      label: "Data residency risk",
      meaning: "Required data would cross a jurisdiction the contract does not cover.",
    },
    {
      id: "LOW_PROCESS_MATURITY",
      label: "Low process maturity",
      meaning: "Underlying process is not stable enough to automate without first cleaning it up.",
    },
    {
      id: "UNCLEAR_OWNER",
      label: "Unclear owner",
      meaning: "No single named person is accountable for outcomes and trade-offs.",
    },
    {
      id: "WEAK_BUSINESS_CASE",
      label: "Weak business case",
      meaning: "Value is not quantified or the beneficiary is not named.",
    },
    {
      id: "VENDOR_LOCK_IN",
      label: "Vendor lock-in",
      meaning: "Choice would tie us to a vendor we cannot exit within the planning horizon.",
    },
    {
      id: "SECURITY_REVIEW_REQUIRED",
      label: "Security review required",
      meaning: "A formal security review must precede further investment.",
    },
    {
      id: "PROMPT_INJECTION_RISK",
      label: "Prompt injection risk",
      meaning: "Inputs include untrusted text or documents that can manipulate the agent.",
    },
    {
      id: "REGULATORY_REVIEW_REQUIRED",
      label: "Regulatory review required",
      meaning: "A regulated workflow needs sign-off from compliance before funding.",
    },
    {
      id: "DEPENDENCY_NOT_READY",
      label: "Dependency not ready",
      meaning: "A required upstream system or dataset will not be available in the cycle.",
    },
  ] as const satisfies readonly ReasonCode[],

  candidateTemplates: [
    {
      id: "invoice_ocr",
      name: "Invoice OCR (worked example)",
      description: "Move supplier invoices from intake to a reviewed, decision-ready state.",
      defaultReasonCodes: ["HITL_MANDATORY"],
    },
    {
      id: "expense_triage",
      name: "Expense report triage",
      description: "Classify employee expense reports and route low-risk items to fast approval.",
      defaultReasonCodes: ["LOW_PROCESS_MATURITY"],
    },
    {
      id: "supplier_risk",
      name: "Supplier risk screening",
      description: "Screen new suppliers against sanctions, news, and credit signals before onboarding.",
      defaultReasonCodes: ["DATA_RESIDENCY_RISK", "REGULATORY_REVIEW_REQUIRED"],
    },
    {
      id: "contract_extraction",
      name: "Contract clause extraction",
      description: "Extract key clauses (payment, renewal, liability) from inbound contracts.",
      defaultReasonCodes: ["PROMPT_INJECTION_RISK"],
    },
  ] as const satisfies readonly CandidateTemplate[],

  automationStepTemplates: [
    {
      id: "capture",
      label: "Capture / intake",
      recommendedLevel: "automate",
      humanControl: "Reviewer can pause intake from a queue.",
    },
    {
      id: "extract",
      label: "Extract / parse",
      recommendedLevel: "automate",
      humanControl: "Per-field confidence triggers HITL below threshold.",
    },
    {
      id: "validate",
      label: "Validate against rules",
      recommendedLevel: "assist",
      humanControl: "Reviewer sees the rule that fired and can override with a written reason.",
    },
    {
      id: "decide",
      label: "Decision / approval",
      recommendedLevel: "manual",
      humanControl: "Named approver makes the call; agent prepares the dossier.",
    },
    {
      id: "act",
      label: "Act on external system",
      recommendedLevel: "assist",
      humanControl: "Write only after approval; reversal handle stored.",
    },
    {
      id: "audit",
      label: "Audit / record",
      recommendedLevel: "automate",
      humanControl: "Append-only events; integrity job checks daily.",
    },
  ] as const satisfies readonly AutomationStepTemplate[],

  decisionOptions: [
    {
      id: "fund" as const,
      label: "Fund",
      summary: "All Gate 3 criteria pass. Allocate the next investment cycle.",
    },
    {
      id: "fund_with_constraints" as const,
      label: "Fund with constraints",
      summary: "Mostly pass; named constraints (residency, HITL, monitoring) are enforceable.",
    },
    {
      id: "defer" as const,
      label: "Defer",
      summary: "Re-score next cycle after a specific dependency or evidence is resolved.",
    },
    {
      id: "stop" as const,
      label: "Stop",
      summary: "Value, risk, or readiness fails. Free the slot for a stronger candidate.",
    },
  ] as const satisfies readonly DecisionOption[],

  gate3Criteria: [
    { id: "portfolio_value", label: "Portfolio value", question: "Does the top candidate quantify value with a named beneficiary?" },
    { id: "data_readiness", label: "Data readiness", question: "Is the required data available, in-scope, and contractually safe to use?" },
    { id: "governance_readiness", label: "Governance readiness", question: "Are residency, training opt-out, audit, and compliance answered (M07/M08)?" },
    { id: "monitoring_path", label: "Monitoring path", question: "Is there a working monitoring and alerting path for production behavior?" },
    { id: "ownership", label: "Ownership", question: "Is there a single named owner accountable for outcomes and trade-offs?" },
    { id: "investment_fit", label: "Investment fit", question: "Does this fit the cycle's strategic priorities and capital envelope?" },
    { id: "risk_acceptance", label: "Risk acceptance", question: "Are residual risks named, owned, and accepted by the right level?" },
    { id: "rollback_stop", label: "Rollback / stop conditions", question: "Are rollback and stop conditions defined and rehearsed?" },
  ] as const,

  methodNote:
    "Gate 3 is not 'we believe in this'. It is 'we will spend on this, under these conditions, and revisit on this date'.",
} as const;

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM09PortfolioScaffold(
  ctx: InvoiceOcrProfileContext,
): PortfolioScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const workedExampleName = `Invoice OCR at ${company} (${volume}, ${country})`;

  const candidatePrompts =
    `Worked example: invoice OCR — already scored end-to-end. ` +
    `Pick three additional candidates from ${company}'s current pipeline (e.g. expense ` +
    `triage, supplier risk screening, contract clause extraction). Each needs a name, a ` +
    `one-sentence description tied to ${country} / ${vat}, and a single named owner.`;

  const scoringGuidance =
    `Score 1-5 on each pillar. Attach a reason code whenever a high score hides a blocker ` +
    `(HITL_MANDATORY for payment, DATA_RESIDENCY_RISK for cross-border data, ` +
    `NO_MONITORING_PATH if production telemetry is absent). Pillars without reason codes are ` +
    `opinions; reason codes without scores are guesses.`;

  const gate3Dossier =
    `Top candidate (likely invoice OCR for ${company}): value is reviewer time + audit ` +
    `defensibility on ${volume}; data flows through ${accounting} under ${vat}; governance ` +
    `posture comes from the M07 ADR and the M08 deployment plan; monitoring runs against the ` +
    `audit log; ownership sits with the AP lead; rollback uses the documented reversal path on ` +
    `${accounting}. Recommendation: fund or fund-with-constraints depending on residency and ` +
    `monitoring evidence.`;

  return { workedExampleName, candidatePrompts, scoringGuidance, gate3Dossier };
}
