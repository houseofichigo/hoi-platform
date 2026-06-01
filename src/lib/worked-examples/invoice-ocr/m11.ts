// src/lib/worked-examples/invoice-ocr/m11.ts
import type { InvoiceOcrProfileContext } from "./m01";

// ── Types ───────────────────────────────────────────────────────────────────

export type MonitoringCategoryId = "performance" | "accuracy" | "drift" | "fairness";
export type DriftTypeId = "data" | "concept" | "model";
export type AlertTier = "info" | "warning" | "critical" | "stop";

export interface MonitoringMetric {
  id: string;
  category: MonitoringCategoryId;
  label: string;
  target: string;
  whyItMatters: string;
}

export interface AlertRule {
  id: string;
  metricId: string;
  tier: AlertTier;
  threshold: string;
  owner: string;
  escalation: string;
}

export interface DriftRule {
  id: DriftTypeId;
  label: string;
  detectionSignal: string;
  response: string;
  rescoringTrigger: string;
}

export interface MonitoringPlanScaffold {
  metrics: string;
  alerts: string;
  driftResponse: string;
  rescoringCriteria: string;
}

// ── Content ─────────────────────────────────────────────────────────────────

export const M11_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "What gets monitored gets sustained. What does not gets rediscovered through incidents.",

  step1: {
    title: "Monitoring metrics",
    why: "A healthy system is watched across four categories. Skip one and that dimension fails silently until a user reports it.",
    example:
      "Performance: P95 latency, throughput. Accuracy: extraction accuracy on a weekly sample. Drift: supplier-mix shift, field-value distribution shift. Fairness: rejection rate by supplier segment.",
    whatToNotice: [
      "Every metric names a target, not a wish",
      "Each metric has a named owner — not 'the team'",
      "Fairness is a metric, not a sentiment",
    ],
    produces: "A metric set spanning performance, accuracy, drift, and fairness",
    nextLabel: "Step 2 — alert thresholds",
  },

  step2: {
    title: "Alert thresholds and escalation",
    why: "Alerts without owners are noise. Tiered alerts (info → warning → critical → stop) route each signal to the human who can act.",
    example:
      "Critical: P95 latency > 8s for 15 minutes → page the on-call owner. Stop: accuracy < 90% for two consecutive samples → pause auto-posting until human review.",
    whatToNotice: [
      "Critical and stop tiers must have a named owner",
      "Stop conditions actually pause behaviour — they do not just notify",
      "Escalation paths name the second responder, not 'leadership'",
    ],
    produces: "A threshold matrix with tiered alerts and named owners",
    nextLabel: "Step 3 — drift response",
  },

  step3: {
    title: "Drift detection and incident response",
    why: "Data, concept, and model drift each look different in the dashboard and require different responses. Naming the type is half the response.",
    example:
      "Data drift: new supplier countries appear. Concept drift: VAT rules change mid-quarter. Model drift: vendor releases a new base model and behaviour shifts.",
    whatToNotice: [
      "Detection signals are observable, not anecdotal",
      "Responses include a kill switch and a re-validation step",
      "Each drift type has a corresponding re-scoring trigger",
    ],
    produces: "A drift response spec covering data, concept, and model drift",
    nextLabel: "Step 4 — monitoring plan + re-scoring",
  },

  step4: {
    title: "Monitoring plan + portfolio re-scoring",
    why: "The 1-page plan is what an operator pins to the wall. Re-scoring triggers are the bridge back to M09 — production reality changing the portfolio.",
    example:
      "Re-score when: accuracy drops below stop threshold; a critical vendor term changes; cost overruns the M08 model by 30%; a new regulatory requirement applies; a security incident has root cause in the agent.",
    whatToNotice: [
      "The 1-page plan is operator-facing, not engineer-facing",
      "Re-scoring is a trigger, not a calendar event",
      "Every trigger names which pillar in M09 it forces a re-check on",
    ],
    produces: "A 1-page monitoring plan and a set of re-scoring triggers tied to M09",
    nextLabel: "Complete M11 → M12",
  },

  metrics: [
    {
      id: "p95_latency",
      category: "performance",
      label: "P95 extraction latency",
      target: "< 5s end-to-end per invoice",
      whyItMatters: "If extraction blocks the AP queue, humans batch around it and accuracy follows.",
    },
    {
      id: "throughput",
      category: "performance",
      label: "Daily throughput",
      target: "≥ expected invoice volume per business day",
      whyItMatters: "Backlog growth is a leading indicator of a silent failure upstream.",
    },
    {
      id: "extraction_accuracy",
      category: "accuracy",
      label: "Extraction field accuracy (sampled)",
      target: "≥ 97% on a weekly 25-invoice sample",
      whyItMatters: "Accuracy decay is the primary signal that the assistant is no longer fit for purpose.",
    },
    {
      id: "hitl_correction_rate",
      category: "accuracy",
      label: "HITL correction rate",
      target: "≤ 8% of approved invoices need a manual correction",
      whyItMatters: "Rising corrections mean the assistant is moving from 'help' to 'rework'.",
    },
    {
      id: "supplier_mix_shift",
      category: "drift",
      label: "Supplier-mix shift (KL divergence)",
      target: "weekly divergence < 0.15 vs. baseline distribution",
      whyItMatters: "A new supplier population means the validators were tuned for a different reality.",
    },
    {
      id: "field_value_drift",
      category: "drift",
      label: "Field value distribution drift",
      target: "no field with > 20% out-of-range share for 2 weeks",
      whyItMatters: "Out-of-range values cluster around schema or rule changes upstream.",
    },
    {
      id: "rejection_rate_by_segment",
      category: "fairness",
      label: "Rejection rate by supplier segment",
      target: "no segment > 1.5× the global rejection rate",
      whyItMatters: "Concentrated rejections in one segment usually mean the model failed that segment, not the suppliers.",
    },
    {
      id: "manual_override_rate",
      category: "fairness",
      label: "Manual override rate by reviewer",
      target: "no reviewer > 2× the median override rate",
      whyItMatters: "Reviewer outliers expose ambiguous rules and uncalibrated thresholds.",
    },
  ] as const satisfies readonly MonitoringMetric[],

  alertRules: [
    {
      id: "latency_critical",
      metricId: "p95_latency",
      tier: "critical",
      threshold: "P95 > 8s for 15 minutes",
      owner: "On-call platform engineer",
      escalation: "Page on-call; if unacknowledged in 10 min, escalate to platform lead.",
    },
    {
      id: "throughput_warning",
      metricId: "throughput",
      tier: "warning",
      threshold: "Daily throughput < 80% of expected for 2 days",
      owner: "AP lead",
      escalation: "Open a ticket; review with platform lead at weekly stand-up.",
    },
    {
      id: "accuracy_stop",
      metricId: "extraction_accuracy",
      tier: "stop",
      threshold: "Accuracy < 90% on two consecutive weekly samples",
      owner: "AP lead",
      escalation: "Pause auto-post; require human review on all invoices until re-validation passes.",
    },
    {
      id: "correction_warning",
      metricId: "hitl_correction_rate",
      tier: "warning",
      threshold: "Correction rate > 12% for one week",
      owner: "AP lead",
      escalation: "Sample 50 corrections with the assistant owner; decide rule vs. retrain.",
    },
    {
      id: "supplier_drift_critical",
      metricId: "supplier_mix_shift",
      tier: "critical",
      threshold: "KL divergence > 0.25 for one week",
      owner: "Assistant owner",
      escalation: "Trigger M09 re-scoring on Process Maturity and AI Suitability pillars.",
    },
    {
      id: "fairness_warning",
      metricId: "rejection_rate_by_segment",
      tier: "warning",
      threshold: "Any segment > 1.5× global rate for 2 weeks",
      owner: "Assistant owner",
      escalation: "Audit failure reasons in the segment; report to governance owner.",
    },
    {
      id: "field_drift_info",
      metricId: "field_value_drift",
      tier: "info",
      threshold: "Any field > 15% out-of-range for 1 week",
      owner: "Assistant owner",
      escalation: "Log to drift register; review at monthly accuracy review.",
    },
  ] as const satisfies readonly AlertRule[],

  driftRules: [
    {
      id: "data",
      label: "Data drift",
      detectionSignal:
        "Supplier-mix KL divergence, new countries, new currencies, or field-value distribution shifts vs. baseline.",
      response:
        "Refresh baseline statistics, retest validators on the new distribution, and notify the AP lead. If divergence persists, expand the HITL queue scope until validators catch up.",
      rescoringTrigger:
        "Re-score the use case on AI Suitability and Process Maturity pillars in M09.",
    },
    {
      id: "concept",
      label: "Concept drift",
      detectionSignal:
        "Rule changes (VAT, residency, supplier terms) or accuracy decay despite stable inputs.",
      response:
        "Pause auto-post for the affected rule scope. Update prompts and validators, re-run regression set, and re-publish only after sign-off from AP lead.",
      rescoringTrigger:
        "Re-score on Risk and Process Maturity pillars; flag regulatory dependency in M09.",
    },
    {
      id: "model",
      label: "Model drift",
      detectionSignal:
        "Vendor releases a new base model, prompt template changes, or the regression set fails on a previously-passing case.",
      response:
        "Pin the previous model version. Run the regression set on the new version in shadow. Promote only after parity is documented and reviewed.",
      rescoringTrigger:
        "Re-score on Feasibility, Risk, and Delivery Readiness pillars in M09.",
    },
  ] as const satisfies readonly DriftRule[],

  rescoringCriteria: [
    {
      id: "accuracy_stop_breached",
      label: "Accuracy stop condition breached",
      detail: "Stop-tier accuracy alert triggers re-scoring on AI Suitability.",
    },
    {
      id: "vendor_term_change",
      label: "Critical vendor term changes",
      detail: "Training opt-out, residency, or pricing terms change — re-score on Risk and Feasibility.",
    },
    {
      id: "cost_overrun_30",
      label: "Cost overrun > 30% vs. M08 model",
      detail: "Re-score on Business Impact and Priority.",
    },
    {
      id: "new_regulation",
      label: "New regulatory requirement applies",
      detail: "Re-score on Risk; flag a governance dependency.",
    },
    {
      id: "security_incident",
      label: "Security incident with agent root cause",
      detail: "Re-score on Risk and Delivery Readiness; halt expansion until closed.",
    },
    {
      id: "fairness_breach",
      label: "Fairness alert sustained for 2+ weeks",
      detail: "Re-score on Risk and AI Suitability; document remediation plan.",
    },
    {
      id: "ownership_change",
      label: "Loss of named owner",
      detail: "Re-score on Delivery Readiness; pause expansion until a backup is named.",
    },
  ] as const satisfies readonly { id: string; label: string; detail: string }[],

  methodNote:
    "Monitoring is the bridge between the deployed system (M08) and the portfolio (M09). When a threshold breaches, the use case re-enters scoring — its tier may change and so may the investment.",
};

// ── Profile-driven scaffold ────────────────────────────────────────────────

export function getM11MonitoringPlanScaffold(
  ctx: InvoiceOcrProfileContext,
): MonitoringPlanScaffold {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? "your country";
  const volume = ctx.invoiceVolume ?? "current invoice volume";
  const vat = ctx.vatContext ?? "your VAT context";

  const metrics =
    `Metrics for ${company} (invoice OCR · ${volume}):\n` +
    `· Performance: P95 latency < 5s, daily throughput ≥ expected.\n` +
    `· Accuracy: field accuracy ≥ 97% on weekly 25-invoice sample; HITL correction rate ≤ 8%.\n` +
    `· Drift: supplier-mix KL < 0.15; no field with > 20% out-of-range share for 2 weeks.\n` +
    `· Fairness: no supplier segment > 1.5× global rejection rate; reviewer overrides within 2× median.`;

  const alerts =
    `Alert tiers (every critical and stop has a named owner):\n` +
    `· Critical — P95 > 8s for 15 min → on-call platform engineer.\n` +
    `· Stop — accuracy < 90% twice → AP lead pauses auto-post, requires human review.\n` +
    `· Warning — correction rate > 12% for one week → AP lead samples with assistant owner.\n` +
    `· Critical — supplier-mix KL > 0.25 → assistant owner triggers M09 re-scoring.\n` +
    `· Warning — fairness breach 2 weeks → assistant owner audits segment, notifies governance owner.`;

  const driftResponse =
    `Drift response (${country}, ${vat}):\n` +
    `· Data drift — refresh baselines, retest validators, expand HITL until parity. Re-score AI Suitability + Process Maturity.\n` +
    `· Concept drift — pause auto-post on the affected scope, update prompts and validators, re-publish after sign-off. Re-score Risk + Process Maturity.\n` +
    `· Model drift — pin previous version, run regression in shadow, promote only after parity sign-off. Re-score Feasibility + Risk + Delivery Readiness.`;

  const rescoringCriteria =
    `Re-scoring triggers for the ${company} portfolio (sends the use case back to M09):\n` +
    `1. Accuracy stop condition breached on ${accounting} posts.\n` +
    `2. Critical vendor term change (training opt-out, residency, pricing).\n` +
    `3. Cost overrun > 30% vs. the M08 model.\n` +
    `4. New regulatory requirement in ${country} (${vat}).\n` +
    `5. Security incident with root cause in the agent.\n` +
    `6. Sustained fairness breach (2+ weeks).\n` +
    `7. Loss of named owner without a backup ready.`;

  return { metrics, alerts, driftResponse, rescoringCriteria };
}
