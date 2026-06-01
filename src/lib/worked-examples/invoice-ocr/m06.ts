// src/lib/worked-examples/invoice-ocr/m06.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type AgentCapabilityId = "extract" | "validate" | "sync" | "notify" | "audit";
export type IntegrationId =
  | "document_storage"
  | "accounting_system"
  | "notification"
  | "audit_log";
export type HitlCheckpointId =
  | "low_confidence"
  | "missing_required"
  | "policy_conflict"
  | "payment_or_sync"
  | "exception";
export type PilotMetricId =
  | "accuracy"
  | "cycle_time"
  | "hitl_rate"
  | "exception_rate"
  | "audit_completeness";

export interface AgentCapability {
  id: AgentCapabilityId;
  title: string;
  goal: string;
  actionBoundary: string;
  evidenceRequired: string;
}

export interface IntegrationPlanItem {
  id: IntegrationId;
  system: string;
  toolPurpose: string;
  allowedActions: readonly string[];
  forbiddenActions: readonly string[];
  loggingRequired: string;
}

export interface HitlCheckpoint {
  id: HitlCheckpointId;
  trigger: string;
  agentMustDo: string;
  humanMustDecide: string;
}

export interface PilotMetric {
  id: PilotMetricId;
  label: string;
  target: string;
  measurement: string;
}

export interface Gate2Criterion {
  id: string;
  label: string;
  question: string;
}

export interface M06AgentScaffold {
  agentGoal: string;
  workflow: string;
  toolPolicy: string;
  memoryPolicy: string;
  pilotScope: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M06_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "An agent is where the system starts doing work. The question is not whether it can act. The question is where it must stop.",

  step1: {
    title: "Agent design — goal, tools, memory, action boundary",
    why: "An assistant answers. An agent acts. Before wiring tools, write the agent's goal, its workflow, what tools it may call, what it must remember, and where it must stop. Without those four boundaries, the agent inherits every gap the prototype faked.",
    example:
      "For invoice OCR: the agent's goal is to move an invoice from intake to a reviewed, decision-ready state — not to approve payment. The workflow is six steps. Tool policy lists what may be called and what is forbidden. Memory holds only the current invoice + audit events.",
    whatToNotice: [
      "Goal is bounded — 'reviewed and decision-ready', not 'paid'",
      "Workflow is short enough to fit on one page",
      "Tool policy names forbidden actions, not just allowed ones",
      "Memory has a lifespan and a deletion trigger",
    ],
    produces: "Agent design blueprint — five scaffold fields filled in",
    nextLabel: "Step 2 — integration plan",
  },

  step2: {
    title: "Tool/MCP integration plan",
    why: "MCP-style integration means the agent reaches external systems through named tools with scoped permissions, schemas, and logs. The plan names four systems and decides their posture before any real connection is wired.",
    example:
      "Document storage, accounting system, notification, audit log. Each integration is mocked, read_only, write_with_approval, or deferred. No live writes are made in the pilot without an explicit HITL approval.",
    whatToNotice: [
      "A planned status is a decision — 'we haven't decided' is not a status",
      "write_with_approval is the only path to a real write in the pilot",
      "Read-only is fine, but read access still needs a log",
      "Deferred integrations belong on the post-pilot list, not in the agent loop",
    ],
    produces: "Integration map — posture chosen for all four systems",
    nextLabel: "Step 3 — HITL checkpoints",
  },

  step3: {
    title: "HITL checkpoints and escalation policy",
    why: "Human-in-the-loop is the non-negotiable safety primitive. Five triggers must each get a severity: required, recommended, or not applicable. Payment/sync and exception/injection are required — full stop.",
    example:
      "Low confidence → recommended. Missing required field → required. Policy conflict → required. Payment or accounting sync → required. Exception or suspected injection → required.",
    whatToNotice: [
      "Required means the agent stops and waits — not 'asks and continues'",
      "Two checkpoints (payment_or_sync, exception) are required by design — not optional",
      "Every checkpoint names what the human decides, not just that they decide",
    ],
    produces: "HITL policy — severity chosen for all five checkpoints",
    nextLabel: "Step 4 — controlled pilot plan",
  },

  step4: {
    title: "Controlled pilot plan",
    why: "A pilot is not a soft launch. It has a named population, a fixed time window, a rollback owner, and metric targets. Without those four, 'we ran a pilot' becomes folklore instead of evidence.",
    example:
      "Population: one AP team, mock + sandbox suppliers. Window: two weeks. Rollback owner: AP lead. Metric targets cover accuracy, cycle time, HITL rate, exception rate, and audit completeness.",
    whatToNotice: [
      "Population is people and data — both bounded",
      "Time window has an end date, not 'until further notice'",
      "Rollback owner is one named person, not a team",
      "Every metric has a measurement method, not just a number",
    ],
    produces: "Pilot plan — population, window, rollback owner, and five metric targets",
    nextLabel: "Step 5 — Gate 2 readiness dossier",
  },

  step5: {
    title: "Gate 2 readiness dossier",
    why: "Gate 2 is the second explicit decision: is the agent ready to expand from the controlled pilot? The dossier synthesizes design, integrations, HITL, and pilot plan so the gate is a real check, not a celebration.",
    example:
      "The dossier names goal clarity, tool permissions, HITL coverage, pilot scope, rollback, auditability, metric targets, and residual risk. Each one gets a yes/partial/no answer at the gate.",
    whatToNotice: [
      "Residual risk is named, not assumed to be zero",
      "Auditability is a gate criterion, not an afterthought",
      "Metric targets without a measurement are unverifiable",
    ],
    produces: "Gate 2 readiness dossier — ready for the gate route",
  },

  capabilities: [
    {
      id: "extract",
      title: "Extract",
      goal: "Pull structured fields from a captured invoice.",
      actionBoundary:
        "May call the OCR/LLM extraction tool. May not invent missing fields — must mark them as missing.",
      evidenceRequired: "Per-field confidence and evidence excerpt or bounding box.",
    },
    {
      id: "validate",
      title: "Validate",
      goal: "Check extracted fields against the schema and contextual rules.",
      actionBoundary:
        "May apply KB01/KB02 rules. May not finalize a tax or legal judgement — flag instead.",
      evidenceRequired: "Validation result per field with the rule id that fired.",
    },
    {
      id: "sync",
      title: "Sync",
      goal: "Write or export approved invoices to the accounting system.",
      actionBoundary:
        "May only write after explicit human approval. Must be idempotent. Must support reversal.",
      evidenceRequired: "External record id, write timestamp, and reversal handle.",
    },
    {
      id: "notify",
      title: "Notify",
      goal: "Notify the right human at the right checkpoint.",
      actionBoundary:
        "May notify named reviewers via the notification channel. May not email external parties.",
      evidenceRequired: "Recipient, channel, message id, and the checkpoint that triggered it.",
    },
    {
      id: "audit",
      title: "Audit",
      goal: "Persist a defensible trail of events, edits, decisions, and reasons.",
      actionBoundary:
        "Must append events. May not edit or delete past audit entries — corrections are new entries.",
      evidenceRequired: "Event id, actor, timestamp, before/after snapshot, reason.",
    },
  ] as const satisfies readonly AgentCapability[],

  integrations: [
    {
      id: "document_storage",
      system: "Document storage",
      toolPurpose: "Read captured invoice files and write extraction artifacts.",
      allowedActions: ["read invoice file by id", "write extraction artifact for an invoice id"],
      forbiddenActions: ["bulk export", "delete original invoice", "share outside workspace"],
      loggingRequired: "Every read and write logged with user, invoice id, tool, timestamp.",
    },
    {
      id: "accounting_system",
      system: "Accounting system",
      toolPurpose: "Write or export approved invoice records.",
      allowedActions: ["create draft record", "attach extraction artifact", "post after approval"],
      forbiddenActions: ["post without approval", "modify historical postings", "release payment"],
      loggingRequired: "Every call logged with approver, payload hash, response id, reversal handle.",
    },
    {
      id: "notification",
      system: "Notification channel",
      toolPurpose: "Notify named reviewers when a checkpoint requires a decision.",
      allowedActions: ["DM a named reviewer", "post in a closed reviewer channel"],
      forbiddenActions: ["email external addresses", "broadcast to wider org"],
      loggingRequired: "Every notification logged with recipient, checkpoint, message id.",
    },
    {
      id: "audit_log",
      system: "Audit log",
      toolPurpose: "Persist immutable events for every agent step and human decision.",
      allowedActions: ["append event", "read event history for an invoice id"],
      forbiddenActions: ["edit past events", "delete events", "redact retroactively"],
      loggingRequired: "Log itself is the audit — integrity check runs daily.",
    },
  ] as const satisfies readonly IntegrationPlanItem[],

  hitlCheckpoints: [
    {
      id: "low_confidence",
      trigger: "Any extracted field below the confidence threshold.",
      agentMustDo: "Pause sync. Surface the field, its confidence, and the evidence excerpt.",
      humanMustDecide: "Accept the value, edit it, or send back for re-extraction.",
    },
    {
      id: "missing_required",
      trigger: "A required schema field is absent from the extraction.",
      agentMustDo: "Stop. Show the schema rule and what is missing.",
      humanMustDecide: "Provide the value, reject the invoice, or flag the supplier.",
    },
    {
      id: "policy_conflict",
      trigger: "Validation hits a VAT/GDPR/internal-policy rule from KB02.",
      agentMustDo: "Stop. Cite the rule and the conflicting field.",
      humanMustDecide: "Apply the rule, override with a written reason, or escalate.",
    },
    {
      id: "payment_or_sync",
      trigger: "About to write to the accounting system or trigger any payment-adjacent action.",
      agentMustDo: "Stop. Show the full diff and the reversal handle that will be created.",
      humanMustDecide: "Approve the write, modify the payload, or cancel.",
    },
    {
      id: "exception",
      trigger: "Exception, unexpected tool error, or suspected prompt injection.",
      agentMustDo:
        "Stop immediately. Quarantine the invoice. Log the trigger and the inputs that caused it.",
      humanMustDecide: "Investigate, release back into the loop, or block the supplier.",
    },
  ] as const satisfies readonly HitlCheckpoint[],

  pilotMetrics: [
    {
      id: "accuracy",
      label: "Extraction accuracy",
      target: "≥ 95% on required fields against the KB03 answer key",
      measurement: "Per-field comparison vs expected_extraction over the pilot set.",
    },
    {
      id: "cycle_time",
      label: "Cycle time",
      target: "Median intake → decision-ready under 10 minutes",
      measurement: "Timestamp delta from capture event to first decision-ready state.",
    },
    {
      id: "hitl_rate",
      label: "HITL rate",
      target: "Required-HITL stops on ≤ 35% of invoices, with zero skipped on payment/sync or exception",
      measurement: "Required checkpoints fired ÷ invoices processed, broken down by checkpoint id.",
    },
    {
      id: "exception_rate",
      label: "Exception rate",
      target: "≤ 2% of invoices hit the exception checkpoint",
      measurement: "Exception checkpoint events ÷ invoices processed.",
    },
    {
      id: "audit_completeness",
      label: "Audit completeness",
      target: "100% of invoices have a full event trail (capture → decision)",
      measurement: "Spot-check sample plus daily integrity job on the audit log.",
    },
  ] as const satisfies readonly PilotMetric[],

  gate2Criteria: [
    { id: "goal_clarity", label: "Goal clarity", question: "Is the agent's goal bounded and stated in one sentence?" },
    { id: "tool_permissions", label: "Tool permissions", question: "Are allowed and forbidden actions named for every integration?" },
    { id: "hitl_coverage", label: "HITL coverage", question: "Are payment/sync and exception/injection both required checkpoints?" },
    { id: "pilot_scope", label: "Pilot scope", question: "Are population, time window, and data set explicitly bounded?" },
    { id: "rollback", label: "Rollback", question: "Is there a named rollback owner and a working reversal path?" },
    { id: "auditability", label: "Auditability", question: "Does every action produce an immutable audit event with evidence?" },
    { id: "metric_targets", label: "Metric targets", question: "Does every pilot metric have a target and a measurement method?" },
    { id: "residual_risk", label: "Residual risk", question: "Is the residual risk named, owned, and acceptable for the pilot scope?" },
  ] as const satisfies readonly Gate2Criterion[],

  methodNote:
    "Agents need brakes before they need speed. A pilot is successful when the stop conditions are as clear as the success metrics.",
} as const;

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM06AgentScaffold(ctx: InvoiceOcrProfileContext): M06AgentScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const agentGoal =
    `Move a supplier invoice at ${company} from intake to a reviewed, decision-ready state ` +
    `in ${country} (${vat}). The agent does not approve payment. It does not post to ` +
    `${accounting} without explicit human approval. Scope: ${volume}.`;

  const workflow =
    `1. Capture: receive invoice file, register in document storage, open an audit trail.\n` +
    `2. Extract: call the OCR/LLM extraction tool, return fields with confidence and evidence.\n` +
    `3. Validate: apply KB01 schema and KB02 contextual rules; flag conflicts and missing fields.\n` +
    `4. HITL: if a required checkpoint fires, stop and notify the named reviewer.\n` +
    `5. Sync: after approval, write a draft record to ${accounting} with reversal handle.\n` +
    `6. Audit: append every step (agent + human) as immutable events.`;

  const toolPolicy =
    `Allowed tools: document storage (read invoice / write artifact), ${accounting} (draft + ` +
    `post-on-approval), notification channel (named reviewers only), audit log (append).\n` +
    `Forbidden: payment release, external email, bulk export, modification of historical ` +
    `postings, retroactive audit edits. Every tool call is logged with actor, payload hash, ` +
    `and response id.`;

  const memoryPolicy =
    `Working memory: only the current invoice's fields, validation results, and reviewer ` +
    `actions, kept until the decision is recorded.\n` +
    `Persistent memory: audit events for ${company} only, retained per policy.\n` +
    `No cross-invoice context. No learning from production data inside the pilot.`;

  const pilotScope =
    `Population: a single AP team at ${company} processing mock + sandbox-supplier invoices ` +
    `in ${country}.\n` +
    `Time window: two weeks, fixed end date.\n` +
    `Rollback owner: one named AP lead with a documented reversal path on ${accounting}.\n` +
    `Out of scope: real payment release, foreign-VAT edge cases not covered by KB02, ` +
    `cross-entity invoices.`;

  return { agentGoal, workflow, toolPolicy, memoryPolicy, pilotScope };
}
