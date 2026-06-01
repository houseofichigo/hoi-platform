// src/lib/worked-examples/invoice-ocr/m05.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type PrototypeSurfaceId = "upload" | "review" | "approve" | "audit";
export type PrototypeRequirementId = "ocr_extraction" | "system_sync" | "hitl_queue";

export interface PrototypeSurface {
  id: PrototypeSurfaceId;
  order: 1 | 2 | 3 | 4;
  title: string;
  purpose: string;
  mustShow: readonly string[];
  sandboxRule: string;
}

export interface PrototypeWalkthroughPrompt {
  id: string;
  question: string;
  captures: string;
}

export interface AgentRequirementCard {
  id: PrototypeRequirementId;
  title: string;
  prototypeFake: string;
  realAgentMust: string;
  riskIfIgnored: string;
}

export interface PrototypeBriefScaffold {
  audience: string;
  appPurpose: string;
  screens: string;
  mockDataRules: string;
  interactionRules: string;
  nonGoals: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M05_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "A prototype is a rehearsal. It makes the workflow visible before the agent can touch systems, money, or customer data.",

  step1: {
    title: "Prototype scope — four surfaces",
    why: "Before writing a brief, name the four surfaces the prototype must show. Upload, review, approve, audit is the minimum loop for AI-supported invoice processing — skip a surface and the agent inherits an invisible gap.",
    example:
      "Upload is invoice capture and mock OCR start. Review shows extracted fields with confidence and evidence. Approve is the explicit human-in-the-loop decision. Audit shows the timeline so the decision is defensible.",
    whatToNotice: [
      "Each surface answers one question — collapsing two surfaces hides the failure mode",
      "Confidence and evidence belong on the review surface, not buried in audit",
      "The approve surface is where HITL becomes real, not theoretical",
      "Audit is for the reviewer who arrives weeks later, not for the engineer",
    ],
    produces: "Four acknowledged surfaces — the blueprint for the no-code brief",
    nextLabel: "Step 2 — no-code build brief",
  },

  step2: {
    title: "No-code build brief",
    why: "A no-code brief is a contract with the builder (Lovable, Bubble, Retool, you). It states what the prototype must show, what it must fake, and what it must never do. Without those boundaries, the prototype quietly drifts toward production and stops being safe.",
    example:
      "The brief seeds Dashboard, Upload, Review, Audit screens; pins a MOCK DATA badge to every view; forbids real auth, real OCR, real AI calls, and real accounting writes; and reuses the HOI design system.",
    whatToNotice: [
      "Mock data only — no real supplier names, IBANs, or VAT numbers",
      "Sandbox rules go in the brief, not in code comments",
      "Frontend only — no Supabase, no OCR API, no accounting write",
      "MOCK DATA badge is always visible so no one mistakes it for the agent",
    ],
    produces: "A Lovable-ready no-code prototype brief",
    nextLabel: "Step 3 — walkthrough → agent requirements",
  },

  step3: {
    title: "Walkthrough findings → agent requirements",
    why: "The prototype only earns its keep if the walkthrough turns friction into requirements. Five prompts force the team to name what the prototype faked and what the M06 agent must actually do — with tools, memory, approvals, and auditability.",
    example:
      "Three requirement cards come out: OCR/extraction the prototype faked; system sync the prototype faked; HITL queue and audit persistence the prototype faked. Each card states the risk if M06 ignores it.",
    whatToNotice: [
      "Walkthrough answers are evidence — agent requirements are commitments",
      "Every fake in the prototype is a job the agent will inherit",
      "Three cards is enough — more dilutes the M06 scope",
    ],
    produces: "Three agent requirement cards ready to feed M06",
  },

  surfaces: [
    {
      id: "upload",
      order: 1,
      title: "Upload",
      purpose: "Capture the invoice and start the mock OCR run.",
      mustShow: [
        "Drag-and-drop or file picker for PDF / image",
        "Visible MOCK DATA badge",
        "Mock OCR progress with a stubbed result, not a real API",
        "Source filename and capture timestamp",
      ],
      sandboxRule: "No file is uploaded anywhere — the prototype simulates progress locally.",
    },
    {
      id: "review",
      order: 2,
      title: "Review",
      purpose: "Show extracted fields with confidence, evidence, and validation warnings.",
      mustShow: [
        "Extracted fields with type and confidence score",
        "Evidence excerpt or bounding-box stub per field",
        "Validation warnings (missing VAT id, total mismatch)",
        "Visible MOCK DATA badge",
      ],
      sandboxRule: "Confidence and evidence are seeded from KB03 mocks, not from a real model.",
    },
    {
      id: "approve",
      order: 3,
      title: "Approve",
      purpose: "Make the human-in-the-loop decision states explicit and irreversible-feeling.",
      mustShow: [
        "Approve, reject, flag for review actions",
        "Required note when rejecting or flagging",
        "Reviewer name and role on the decision",
        "Reminder that no real accounting write is performed",
      ],
      sandboxRule: "Approval only updates local state — no posting, no email, no real sync.",
    },
    {
      id: "audit",
      order: 4,
      title: "Audit",
      purpose: "Make the decision trail defensible for the reviewer who arrives weeks later.",
      mustShow: [
        "Timeline of events (upload, extraction, edits, decision)",
        "Source references for each extracted field",
        "Edits with before/after values and editor",
        "Final decision with reviewer and timestamp",
      ],
      sandboxRule: "Audit data lives only in the prototype — there is no real audit log persistence.",
    },
  ] as const satisfies readonly PrototypeSurface[],

  walkthroughPrompts: [
    {
      id: "finance_understands",
      question: "Can finance understand what the AI extracted?",
      captures: "Field labels, units, and confidence are legible to a non-technical reviewer.",
    },
    {
      id: "evidence_visible",
      question: "Can a reviewer see evidence and confidence quickly?",
      captures: "Evidence and confidence appear on the review surface, not hidden in audit.",
    },
    {
      id: "approval_obvious",
      question: "Is the human approval point obvious?",
      captures: "The HITL moment is unmistakable — no implicit approval-by-default.",
    },
    {
      id: "audit_defensible",
      question: "Is the audit trail defensible?",
      captures: "A reviewer arriving weeks later can reconstruct who decided what and why.",
    },
    {
      id: "fakes_to_automate",
      question: "What did the prototype fake that the real agent must automate?",
      captures: "Named fakes become the M06 agent requirements.",
    },
  ] as const satisfies readonly PrototypeWalkthroughPrompt[],

  defaultRequirementCards: [
    {
      id: "ocr_extraction",
      title: "OCR & extraction",
      prototypeFake: "Prototype fakes OCR by seeding extracted fields from KB03 mock invoices.",
      realAgentMust:
        "Real agent must call an OCR / LLM extraction tool, validate fields against the schema, and emit confidence + evidence per field.",
      riskIfIgnored:
        "Without real extraction and validation, the agent ships hallucinated invoice fields straight into approval.",
    },
    {
      id: "system_sync",
      title: "Accounting system sync",
      prototypeFake: "Prototype fakes accounting sync — approval only flips local state.",
      realAgentMust:
        "Real agent must write or export approved records to the accounting system safely, with retries, idempotency, and a reversal path.",
      riskIfIgnored:
        "Without governed sync, approvals silently fail to post or post twice — both corrupt the ledger.",
    },
    {
      id: "hitl_queue",
      title: "HITL queue & audit persistence",
      prototypeFake: "Prototype fakes the HITL queue and audit log — both live only in browser state.",
      realAgentMust:
        "Real agent must persist queue state and audit events durably, with reviewer identity, decision, evidence, and timestamps.",
      riskIfIgnored:
        "Without persistent queue and audit, decisions disappear on refresh and the workflow is undefensible.",
    },
  ] as const satisfies readonly AgentRequirementCard[],

  methodNote:
    "The prototype is not pretending to be production. It is exposing the places where production will need tools, permissions, memory, and human control.",
} as const;

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM05PrototypeBriefScaffold(
  ctx: InvoiceOcrProfileContext,
): PrototypeBriefScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const audience =
    `Builder brief for a no-code prototype (Lovable, Bubble, or Retool).\n` +
    `Audience: ${company} finance + AP reviewers in ${country}.\n` +
    `Domain: invoice OCR (supplier invoice processing), not expenses-only.\n` +
    `Context: ${volume}, VAT context — ${vat}, accounting system — ${accounting}.`;

  const appPurpose =
    `Build a FRONTEND-ONLY prototype that rehearses the AI-supported invoice review loop.\n` +
    `It demonstrates upload → review → approve → audit using MOCK DATA so reviewers can ` +
    `experience the workflow before the M06 agent is built. The prototype is a rehearsal, ` +
    `not a production app.`;

  const screens =
    `Four tabs / screens, in this order:\n` +
    `1. Dashboard — list of mock invoices with status (new, in review, approved, rejected, flagged).\n` +
    `2. Upload — drag-and-drop / file picker. Show a mock OCR progress bar, then a stubbed extraction result. No real upload.\n` +
    `3. Review — extracted fields with type, confidence score, evidence excerpt, and validation warnings. Editable inline.\n` +
    `4. Audit — timeline (upload → extraction → edits → decision), source references, before/after values, reviewer identity.\n` +
    `An always-visible MOCK DATA badge sits in the top-right of every screen.`;

  const mockDataRules =
    `MOCK DATA ONLY.\n` +
    `- All supplier names, IBANs, VAT numbers, and amounts are synthetic.\n` +
    `- Seed 6–10 mock invoices covering: clean baseline, missing VAT id, foreign supplier, ` +
    `total mismatch, duplicate, and an embedded "ignore prior instructions" note.\n` +
    `- Every extraction result carries test_only: true.\n` +
    `- The MOCK DATA badge is always visible so no one mistakes the prototype for the agent.`;

  const interactionRules =
    `Interaction rules:\n` +
    `- Approve / reject / flag are explicit buttons; rejecting or flagging requires a note.\n` +
    `- Edits to extracted fields are recorded with before / after / editor / timestamp.\n` +
    `- The audit timeline is read-only and reconstructable from local state.\n` +
    `- Use the HOI design system tokens (terracotta accent, navy text, mist surface, ` +
    `chalk borders, font-mono eyebrows). No new color palette.`;

  const nonGoals =
    `NON-GOALS — the prototype must NOT do any of these:\n` +
    `- No real authentication, no Supabase, no user accounts.\n` +
    `- No real OCR API call (Tesseract, Google Vision, Azure, AWS).\n` +
    `- No real AI / LLM call.\n` +
    `- No write to ${accounting} or any other accounting system.\n` +
    `- No production integration, webhook, or external email.\n` +
    `- No persistence beyond browser state — refresh may reset the demo.\n` +
    `If a feature requires any of the above, document it instead of building it. It becomes ` +
    `an M06 agent requirement, not a prototype feature.`;

  return {
    audience,
    appPurpose,
    screens,
    mockDataRules,
    interactionRules,
    nonGoals,
  };
}
