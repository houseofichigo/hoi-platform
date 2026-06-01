// src/lib/worked-examples/invoice-ocr/m10.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type DocumentationLayerId = "architecture" | "decisions" | "governance";
export type HandoffStageId =
  | "review"
  | "shadow"
  | "joint"
  | "backup"
  | "ownership";

export interface DocumentationLayer {
  id: DocumentationLayerId;
  title: string;
  purpose: string;
  mustInclude: readonly string[];
}

export interface SystemCardSection {
  id: string;
  title: string;
  prompt: string;
}

export interface PlaybookRoutine {
  id: string;
  cadence: "Daily" | "Weekly" | "Monthly" | "Incident";
  title: string;
  operatorAction: string;
  escalationRule: string;
}

export interface HandoffStage {
  id: HandoffStageId;
  title: string;
  operatorDoes: string;
  builderDoes: string;
  exitCriteria: string;
}

export interface DocumentationScaffold {
  outline: string;
  systemCard: string;
  operatingPlaybook: string;
  handoffPlan: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M10_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "Documentation is how the system survives the original builder. If it only lives in memory, it is not operational.",

  step1: {
    title: "Documentation outline",
    why: "Three layers — architecture, decisions, governance — give the next operator a map. Skipping a layer guarantees the system becomes one person's secret.",
    example:
      "Architecture: what runs where. Decisions: the ADR set from M07 + the deployment plan from M08. Governance: who can override, who is notified, who owns the kill switch.",
    whatToNotice: [
      "Architecture documents the system, not the code",
      "Decisions link to the ADRs already written in M07",
      "Governance names humans, not roles",
    ],
    produces: "A three-layer documentation outline that another operator could navigate without you",
    nextLabel: "Step 2 — system card + playbook",
  },

  step2: {
    title: "System card + operating playbook",
    why: "The system card is the EU AI Act governance technical documentation surface: purpose, users, data, risks, oversight. The playbook is what the AP/finance team actually opens on Monday morning.",
    example:
      "System card: intended purpose, named users, data sources, model/assistant/agent behaviour, oversight, risks, monitoring, change management. Playbook: daily queue check, weekly accuracy review, monthly cost review, incident response.",
    whatToNotice: [
      "The system card answers regulators; the playbook answers operators",
      "Tacit moves to explicit: every implicit step becomes a routine",
      "Each routine has an escalation rule, not just an action",
    ],
    produces: "A system card aligned to technical documentation and a 2-3 page operator playbook",
    nextLabel: "Step 3 — five-stage handoff",
  },

  step3: {
    title: "Five-stage handoff plan",
    why: "Ownership transferred in one ceremony fails. Review → Shadow → Joint → Backup → Ownership gives the operator real reps before holding the keys.",
    example:
      "Review: operator reads everything and asks. Shadow: operator watches the builder run it. Joint: they run it together. Backup: operator runs it, builder on call. Ownership: operator owns it, builder is consulted.",
    whatToNotice: [
      "Each stage has an exit criterion — not a date",
      "Backup is the longest stage; do not collapse it",
      "Ownership requires a named operator and a named backup",
    ],
    produces: "A handoff plan with five stages, named operator, named backup, and exit criteria",
    nextLabel: "Complete M10 → M11",
  },

  documentationLayers: [
    {
      id: "architecture",
      title: "Architecture layer",
      purpose:
        "Describe what runs where, how data moves, and which boundaries the system honours.",
      mustInclude: [
        "Component diagram (assistant, agent, storage, accounting, audit)",
        "Data flow with residency and retention",
        "Integration map and credentials inventory",
      ],
    },
    {
      id: "decisions",
      title: "Decisions layer",
      purpose:
        "Capture the ADR trail so future operators understand why the system looks the way it does.",
      mustInclude: [
        "Tool Selection ADR from M07",
        "Deployment plan summary from M08",
        "Portfolio decision and constraints from M09",
      ],
    },
    {
      id: "governance",
      title: "Governance layer",
      purpose:
        "Name the humans and the controls — who can override, who is notified, who owns the kill switch.",
      mustInclude: [
        "Named owner, named backup, escalation chain",
        "HITL checkpoints and override log policy",
        "Change-management and review cadence",
      ],
    },
  ] as const satisfies readonly DocumentationLayer[],

  systemCardSections: [
    {
      id: "intended_purpose",
      title: "Intended purpose",
      prompt:
        "One paragraph: what the system is for, what it is not for, and the population of inputs it handles.",
    },
    {
      id: "users",
      title: "Users and affected parties",
      prompt:
        "Who operates the system, who is affected by its outputs, and what recourse they have.",
    },
    {
      id: "data_sources",
      title: "Data sources",
      prompt:
        "Inputs and reference data, including provenance, residency, retention, and PII classification.",
    },
    {
      id: "model_behaviour",
      title: "Model / assistant / agent behaviour",
      prompt:
        "Which models, prompts, and tools are used; what the assistant does vs. what the agent does autonomously.",
    },
    {
      id: "human_oversight",
      title: "Human oversight",
      prompt:
        "HITL checkpoints, override mechanism, named owner, and conditions that require a human in the loop.",
    },
    {
      id: "risks",
      title: "Risks and mitigations",
      prompt:
        "Top failure modes (hallucination, PII leakage, schema drift, prompt injection) and what mitigates each.",
    },
    {
      id: "monitoring",
      title: "Monitoring",
      prompt:
        "Metrics tracked, alert thresholds, drift detection, audit log integrity, and incident triage path.",
    },
    {
      id: "change_management",
      title: "Change management",
      prompt:
        "How prompts, models, and tools are versioned; review cadence; rollback path; and re-validation triggers.",
    },
  ] as const satisfies readonly SystemCardSection[],

  playbookRoutines: [
    {
      id: "daily_queue",
      cadence: "Daily",
      title: "HITL queue check",
      operatorAction:
        "Clear yesterday's HITL queue. Approve, correct, or reject each invoice; tag the reason on every rejection.",
      escalationRule:
        "If queue > daily SLA or rejection rate > baseline ×2, page the named owner.",
    },
    {
      id: "daily_audit",
      cadence: "Daily",
      title: "Audit log integrity check",
      operatorAction:
        "Confirm the previous day's audit job is green and event count matches the invoice count.",
      escalationRule:
        "On any mismatch, freeze new posts and escalate to security owner.",
    },
    {
      id: "weekly_accuracy",
      cadence: "Weekly",
      title: "Accuracy review",
      operatorAction:
        "Sample 25 processed invoices. Score against ground truth. Log results in the accuracy sheet.",
      escalationRule:
        "If accuracy < threshold for two consecutive weeks, trigger re-scoring in M09.",
    },
    {
      id: "weekly_exceptions",
      cadence: "Weekly",
      title: "Exception review",
      operatorAction:
        "Walk the top rejection reasons with the AP lead. Decide which become rules, which become training examples.",
      escalationRule:
        "If a new failure mode appears, open an incident and add it to the risk register.",
    },
    {
      id: "monthly_cost",
      cadence: "Monthly",
      title: "Cost + vendor review",
      operatorAction:
        "Reconcile actual spend against the M08 cost model. Refresh forecast. Confirm DPA + training opt-out still hold.",
      escalationRule:
        "If spend > forecast +20% or a vendor term changes, notify owner and finance.",
    },
    {
      id: "incident_response",
      cadence: "Incident",
      title: "Incident response",
      operatorAction:
        "Pull the kill switch (revoke service-account credentials, pause orchestration). Notify Finance + IT within 30 minutes. Open an incident ticket.",
      escalationRule:
        "All incidents reviewed within 5 business days; rollback drill within 30 days if root cause is integration-related.",
    },
  ] as const satisfies readonly PlaybookRoutine[],

  handoffStages: [
    {
      id: "review",
      title: "1. Review",
      operatorDoes:
        "Read the documentation pack end-to-end. List unclear sections. Ask every question.",
      builderDoes:
        "Walk the operator through architecture, decisions, and governance layers. Answer in writing.",
      exitCriteria:
        "Operator can explain back the system in their own words; all questions logged and answered.",
    },
    {
      id: "shadow",
      title: "2. Shadow",
      operatorDoes:
        "Watch the builder run the daily and weekly routines for one full cycle.",
      builderDoes:
        "Run routines exactly as documented. Narrate what is happening and why.",
      exitCriteria:
        "Operator has shadowed at least one daily, one weekly, and one incident drill.",
    },
    {
      id: "joint",
      title: "3. Joint",
      operatorDoes:
        "Run routines with the builder present. Make the call; builder confirms.",
      builderDoes:
        "Stay quiet unless the operator asks. Document every correction.",
      exitCriteria:
        "Two consecutive weeks with zero correction-required interventions.",
    },
    {
      id: "backup",
      title: "4. Backup",
      operatorDoes:
        "Run all routines alone. Builder is on call but not present.",
      builderDoes:
        "Available within SLA. Track which incidents required builder support.",
      exitCriteria:
        "Four consecutive weeks where no incident required builder support beyond informational questions.",
    },
    {
      id: "ownership",
      title: "5. Ownership",
      operatorDoes:
        "Own the system. Decide changes, escalations, and re-scoring triggers.",
      builderDoes:
        "Consulted on architectural changes only. Hands off the kill switch credential.",
      exitCriteria:
        "Named owner and named backup recorded in governance log; ownership review scheduled at 90 days.",
    },
  ] as const satisfies readonly HandoffStage[],

  methodNote:
    "EU/HOI governance expects technical documentation that lets an accountable reviewer reconstruct the system: purpose, data, controls, validation, oversight, monitoring, and GDPR/ISO 42001 posture. The playbook is the operator's mirror of that document - same facts, written for a Monday morning.",
};

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM10DocumentationScaffold(
  ctx: InvoiceOcrProfileContext,
): DocumentationScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const outline =
    `Documentation Pack — Invoice OCR (${company})\n\n` +
    `Layer 1 — Architecture\n` +
    `  · Component diagram: M05 prototype, M06 agent, ${accounting}, audit log\n` +
    `  · Data flow: capture → extract → validate → sync → audit → delete\n` +
    `  · Residency: pinned to ${country}; retention per ${vat}\n\n` +
    `Layer 2 — Decisions\n` +
    `  · M07 Tool Selection ADR (context, options, decision, rationale, consequences, review)\n` +
    `  · M08 Deployment plan (architecture, security risks, cost, rollback, partner handoff)\n` +
    `  · M09 portfolio decision and constraints\n\n` +
    `Layer 3 — Governance\n` +
    `  · Named owner: AP lead. Named backup: Finance ops.\n` +
    `  · HITL checkpoints from M06 with override log policy\n` +
    `  · Change management: prompt + model versioning, review cadence, rollback path`;

  const systemCard =
    `Intended purpose: Extract structured fields from supplier invoices for ${company} ` +
    `and post drafts to ${accounting} on human approval. Not for fraud detection. ` +
    `Not for spend approval.\n\n` +
    `Users and affected parties: AP team operates; suppliers are affected by payment timing; ` +
    `Finance is the accountable owner.\n\n` +
    `Data sources: supplier PDFs and emails (${volume}); reference master data from ${accounting}; ` +
    `audit events stored in the ${country} region per ${vat}.\n\n` +
    `Model / assistant / agent behaviour: assistant answers AP questions with retrieval; agent ` +
    `extracts fields, validates, and prepares a draft post — never auto-posts without HITL approval.\n\n` +
    `Human oversight: HITL on confidence < threshold, new supplier, and amount > limit. AP lead ` +
    `holds the kill switch.\n\n` +
    `Risks and mitigations: hallucinated fields → schema-locked extraction + validators; PII leakage ` +
    `→ field allowlist + scrubber + signed no-training clause; schema drift → contract tests on every ` +
    `release; prompt injection → input sanitisation on supplier text.\n\n` +
    `Monitoring: accuracy sample, rejection rate, queue depth, latency, cost, drift alerts, audit ` +
    `integrity job (see M11).\n\n` +
    `Change management: prompts and models versioned; weekly review; rollback drill quarterly; ` +
    `re-validation on any model or prompt change.`;

  const operatingPlaybook =
    `Operating Playbook — Invoice OCR for the ${company} AP team\n\n` +
    `Daily — HITL queue: clear yesterday's queue, tag every rejection reason. Escalate if queue > SLA ` +
    `or rejection rate > baseline ×2.\n` +
    `Daily — Audit integrity: confirm the previous day's audit job is green and event count matches ` +
    `invoice count. On mismatch, freeze posts and call security.\n\n` +
    `Weekly — Accuracy review: sample 25 invoices, score, log. If accuracy < threshold two weeks in a ` +
    `row, trigger M09 re-scoring.\n` +
    `Weekly — Exception review: walk top rejection reasons with the AP lead; convert recurring ones ` +
    `into rules.\n\n` +
    `Monthly — Cost + vendor: reconcile spend against the M08 cost model; refresh forecast; confirm ` +
    `DPA and training opt-out still apply for ${country}.\n\n` +
    `Incident — Kill switch: revoke service-account credentials, pause orchestration, notify Finance ` +
    `+ IT within 30 minutes, open ticket. Postmortem within 5 business days.`;

  const handoffPlan =
    `Handoff plan — Invoice OCR (${company})\n\n` +
    `Stage 1 Review — Operator reads the pack; builder answers in writing. ` +
    `Exit: operator explains the system back in their own words.\n` +
    `Stage 2 Shadow — Operator watches one full cycle of daily, weekly, and one incident drill.\n` +
    `Stage 3 Joint — Operator runs routines; builder confirms. ` +
    `Exit: two clean weeks.\n` +
    `Stage 4 Backup — Operator runs alone; builder on call. ` +
    `Exit: four clean weeks with no required builder support.\n` +
    `Stage 5 Ownership — Operator owns; builder consulted only on architecture. ` +
    `Named owner: AP lead. Named backup: Finance ops. Review at 90 days.`;

  return { outline, systemCard, operatingPlaybook, handoffPlan };
}
