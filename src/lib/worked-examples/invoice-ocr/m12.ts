// src/lib/worked-examples/invoice-ocr/m12.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type RoadmapHorizonId = "now" | "next" | "later";
export type CapabilityGapId = "people" | "tools" | "partnerships" | "governance";

export interface RoadmapHorizon {
  id: RoadmapHorizonId;
  label: string;
  timeframe: string;
  purpose: string;
}

export interface CapabilityGap {
  id: CapabilityGapId;
  label: string;
  question: string;
  exampleGap: string;
}

export interface ExecutiveScorecardMetric {
  id: string;
  label: string;
  whyItMatters: string;
  suggestedTarget: string;
}

export interface StrategyScaffold {
  roadmapNarrative: string;
  capabilityGaps: string;
  executiveScorecard: string;
  nextPilotCycle: string;
  executiveSummary: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M12_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "A working pilot is not a strategy. M12 turns the portfolio into the document an executive sponsor can sign.",

  step1: {
    title: "Portfolio → roadmap sequencing",
    why: "A scored portfolio without a sequence is a wish list. The roadmap sequences candidates across three horizons so capacity, dependencies, and governance can be planned, not assumed.",
    example:
      "Now (0-3m): scale invoice OCR to a second AP team. Next (3-9m): launch expense report triage; pilot supplier risk screening. Later (9-12m): contract clause extraction, contingent on legal sign-off and a new vector store.",
    whatToNotice: [
      "Each horizon answers a different question: deliver, prove, prepare",
      "Dependencies (data, governance, vendor) drive sequence — not enthusiasm",
      "Sequencing rationale names the capacity constraint, not just the priority",
    ],
    produces: "A now/next/later roadmap with sequencing rationale",
    nextLabel: "Step 2 — capability gaps",
  },

  step2: {
    title: "Capability gap analysis",
    why: "Roadmaps fail at the boundary between portfolio ambition and organisational capacity. Gaps in people, tools, partnerships, and governance are what slip the plan — name them and assign them now.",
    example:
      "People: no second AP lead trained on the assistant. Tools: vector store decision still open for legal corpus. Partnerships: deployment partner for accounting integration not under contract. Governance: EU AI Act technical documentation owner not named.",
    whatToNotice: [
      "Every gap has a named owner and a next action — not a category lead",
      "Partnerships and governance are first-class, not afterthoughts",
      "A gap with no owner is a roadmap risk, not a roadmap line",
    ],
    produces: "A capability gap matrix covering people, tools, partnerships, governance",
    nextLabel: "Step 3 — executive scorecard",
  },

  step3: {
    title: "Executive scorecard",
    why: "The sponsor needs one page to track program health across investment, risk, governance, and impact. The scorecard is the standing artifact between the roadmap and the next review.",
    example:
      "Live systems: 1. Pilots running: 2. Gate status: G2 passed for triage, G3 pending for risk screening. Forecast spend vs. M08 model: -5%. HITL load: stable. EU AI Act governance docs current: yes.",
    whatToNotice: [
      "Every metric has a target — not a wish",
      "Metrics span investment, risk, governance, and outcome",
      "The scorecard is short enough to read in a meeting",
    ],
    produces: "A selected scorecard with at least 6 metrics and explicit targets",
    nextLabel: "Step 4 — executive summary",
  },

  step4: {
    title: "Executive summary and next pilot cycle",
    why: "The summary is what the sponsor signs. It restates the portfolio bet, the roadmap, the gaps being closed, and the go/no-go criteria for the next pilot.",
    example:
      "We will scale invoice OCR, launch two new pilots (expense triage, supplier risk), and prepare contract clause extraction. Total ask: EUR 960k across 12 months. Stop conditions: accuracy regression on OCR, EU AI Act governance docs not closed by Q2, partnership unsigned by Q3.",
    whatToNotice: [
      "The summary names the bet, the price, and the stop conditions on one page",
      "Next-pilot criteria are explicit — sponsor knows when to greenlight",
      "Rollback and review cadence are stated, not implied",
    ],
    produces: "A signed-ready executive summary with explicit go/no-go criteria",
    nextLabel: "Complete M12 → Handoff Pack done",
  },

  horizons: [
    {
      id: "now",
      label: "Now",
      timeframe: "0-3 months",
      purpose: "Deliver what is funded: ship live systems and scale what already works.",
    },
    {
      id: "next",
      label: "Next",
      timeframe: "3-9 months",
      purpose: "Prove the next bets: pilot candidates that survived M09 with constraints.",
    },
    {
      id: "later",
      label: "Later",
      timeframe: "9-12 months",
      purpose: "Prepare conditions: close governance, data, or partnership gaps for deferred candidates.",
    },
  ] as const satisfies readonly RoadmapHorizon[],

  capabilityGaps: [
    {
      id: "people",
      label: "People",
      question: "Who is missing to deliver the now and next horizon?",
      exampleGap: "Second AP lead trained on the assistant; no backup assistant owner; no analyst for monitoring review.",
    },
    {
      id: "tools",
      label: "Tools",
      question: "Which platforms, models, or infrastructure decisions are still open?",
      exampleGap: "Vector store choice for legal corpus; monitoring dashboard; vendor opt-out confirmation for the next pilot.",
    },
    {
      id: "partnerships",
      label: "Partnerships",
      question: "Which external partners or vendors must be under contract?",
      exampleGap: "Deployment partner for accounting integration; legal review firm for contract clause extraction; OCR vendor renegotiation.",
    },
    {
      id: "governance",
      label: "Governance",
      question: "Which routines, approvals, or documentation must be in place?",
      exampleGap: "EU AI Act technical documentation owner; quarterly portfolio re-scoring cadence; incident review routine.",
    },
  ] as const satisfies readonly CapabilityGap[],

  scorecardMetrics: [
    {
      id: "live_systems",
      label: "Live AI systems in production",
      whyItMatters: "Live count is the proof the program delivers — not the slide count.",
      suggestedTarget: "≥ 1 by end of Now horizon; ≥ 2 by end of Next.",
    },
    {
      id: "pilots_running",
      label: "Pilots currently running",
      whyItMatters: "Pilots are the pipeline of next-quarter production systems.",
      suggestedTarget: "2 active pilots, each with a named Gate decision date.",
    },
    {
      id: "gate_status",
      label: "Portfolio gate status",
      whyItMatters: "Gate status shows whether the portfolio is moving or stuck at a checkpoint.",
      suggestedTarget: "No candidate stuck > 1 quarter at the same gate.",
    },
    {
      id: "spend_vs_model",
      label: "Spend vs. M08 cost model",
      whyItMatters: "A drift from the cost model signals the roadmap is being repriced silently.",
      suggestedTarget: "Within ±15% of the M08 model per quarter.",
    },
    {
      id: "hitl_load",
      label: "HITL review load per live system",
      whyItMatters: "Rising HITL load means the assistant is moving from help to rework.",
      suggestedTarget: "HITL load stable or declining quarter-over-quarter.",
    },
    {
      id: "incidents_open",
      label: "Open AI incidents",
      whyItMatters: "Open incidents are the leading risk indicator the sponsor cares about.",
      suggestedTarget: "0 critical incidents open; all warnings owned with a date.",
    },
    {
      id: "governance_docs",
      label: "Governance docs current",
      whyItMatters: "EU AI Act governance and internal docs current means an audit can be answered this week.",
      suggestedTarget: "100% of live systems have a current system card and operating playbook.",
    },
    {
      id: "business_impact",
      label: "Realised business impact",
      whyItMatters: "Impact translates capability into the sponsor's language — hours, euros, error rate.",
      suggestedTarget: "Quantified per live system, reported every quarter.",
    },
    {
      id: "capability_gap_closed",
      label: "Capability gaps closed vs. opened",
      whyItMatters: "If new gaps outpace closed ones, the roadmap will slip next quarter.",
      suggestedTarget: "Net gaps closed ≥ net gaps opened per quarter.",
    },
  ] as const satisfies readonly ExecutiveScorecardMetric[],

  nextPilotCriteria: [
    {
      id: "named_owner",
      label: "Named owner ready",
      detail: "The next pilot has a named owner with explicit time allocation, not a placeholder.",
    },
    {
      id: "m09_score",
      label: "Passes M09 scoring",
      detail: "Candidate has a current eight-pillar score with no critical reason-code blockers.",
    },
    {
      id: "data_ready",
      label: "Data layer ready",
      detail: "Internal, contextual, and task-specific data sources are inventoried (M02 standard).",
    },
    {
      id: "gov_ready",
      label: "Governance pre-cleared",
      detail: "Risk, residency, and EU AI Act governance posture pre-cleared by the governance owner.",
    },
    {
      id: "rollback",
      label: "Rollback path defined",
      detail: "Stop conditions and rollback steps are written before the pilot starts.",
    },
    {
      id: "budget_locked",
      label: "Budget locked vs. M08 model",
      detail: "Pilot budget approved within the M08 cost model envelope.",
    },
    {
      id: "sponsor_review",
      label: "Sponsor review cadence",
      detail: "Sponsor review cadence set (monthly or fortnightly) before kickoff.",
    },
  ] as const satisfies readonly { id: string; label: string; detail: string }[],

  methodNote:
    "The roadmap is the temporal projection of the M09 portfolio. If portfolio scores or constraints change, the roadmap is re-issued — not patched in a footnote.",
};

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM12StrategyScaffold(
  ctx: InvoiceOcrProfileContext,
): StrategyScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const roadmapNarrative =
    `12-month roadmap for ${company} (${country}):\n` +
    `· Now (0-3m): scale invoice OCR (${volume}, ${accounting}) to a second AP team; close monitoring on the live system.\n` +
    `· Next (3-9m): launch the highest-scoring M09 candidate as a pilot; bring a second candidate to Gate 2.\n` +
    `· Later (9-12m): prepare deferred candidates — close governance and data gaps so they can enter Now next year.\n` +
    `Sequencing rationale: capacity, data readiness, and governance posture — not enthusiasm.`;

  const capabilityGaps =
    `Capability gaps for ${company}:\n` +
    `· People — second AP lead trained on the assistant; backup assistant owner; analyst for monitoring review.\n` +
    `· Tools — monitoring dashboard live; vector store decision for next-pilot corpus; vendor opt-out confirmation.\n` +
    `· Partnerships — deployment partner under contract for ${accounting} integration; legal review firm for next-pilot scope.\n` +
    `· Governance — EU AI Act governance technical documentation owner named; quarterly portfolio re-scoring cadence agreed; incident review routine live.`;

  const executiveScorecard =
    `Executive scorecard for ${company} AI program:\n` +
    `· Live systems: target ≥ 1 by Q1, ≥ 2 by Q3.\n` +
    `· Pilots running: 2 with named Gate dates.\n` +
    `· Spend vs. M08 model: within ±15% per quarter.\n` +
    `· HITL load: stable or declining quarter-over-quarter.\n` +
    `· Open incidents: 0 critical; all warnings owned.\n` +
    `· Governance docs current: 100% of live systems.\n` +
    `· Realised impact: hours/euros saved reported per quarter.`;

  const nextPilotCycle =
    `Next pilot cycle gates (go/no-go for the next candidate from M09):\n` +
    `1. Named owner with explicit time allocation.\n` +
    `2. Current eight-pillar score; no critical reason-code blockers.\n` +
    `3. Data layer inventoried to M02 standard for ${vat}.\n` +
    `4. Governance pre-cleared (risk, residency, EU AI Act governance).\n` +
    `5. Rollback path written before kickoff.\n` +
    `6. Budget locked within M08 envelope.`;

  const executiveSummary =
    `Executive summary — ${company} AI program, 12 months.\n\n` +
    `Bet. The portfolio scored in M09 names invoice OCR as the production system to scale and ` +
    `up to three additional candidates to pilot. The roadmap sequences these across Now (0-3m), Next (3-9m), and Later (9-12m).\n\n` +
    `Roadmap. Now: scale invoice OCR (${volume}, ${accounting}) to a second AP team; close monitoring. ` +
    `Next: launch the highest-scoring M09 candidate as a pilot and bring a second to Gate 2. ` +
    `Later: prepare deferred candidates by closing governance and data gaps.\n\n` +
    `Gaps being closed. A second trained AP lead; a monitoring dashboard live; a deployment ` +
    `partner under contract; an EU AI Act technical documentation owner named; a quarterly portfolio ` +
    `re-scoring cadence agreed.\n\n` +
    `Stop conditions. Accuracy regression on the live system breaches the M11 stop tier; ` +
    `EU AI Act governance documentation not closed by the agreed quarter; deployment partner not under contract by Q3; ` +
    `cost overrun > 30% vs. the M08 cost model.\n\n` +
    `Review cadence. Monthly scorecard to sponsor; quarterly portfolio re-score against M09; annual ` +
    `roadmap re-issue. The roadmap is the temporal projection of the portfolio — it changes when the portfolio changes.`;

  return {
    roadmapNarrative,
    capabilityGaps,
    executiveScorecard,
    nextPilotCycle,
    executiveSummary,
  };
}
