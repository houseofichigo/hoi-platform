export type DecisionBucket = "start-now" | "prepare-first" | "governance-review" | "fix-foundations";

export interface RecommendedAction {
  id: string;
  label: string;
  why: string;
  priority: "now" | "soon" | "later";
}

export interface BucketInput {
  priority: number;
  readiness: number;
  quadrant?: string | null;
  reasonCodes?: string[];
  govCount?: number;
  hasHardStop?: boolean;
}

export const BUCKET_ORDER: DecisionBucket[] = [
  "start-now",
  "prepare-first",
  "governance-review",
  "fix-foundations",
];

export const BUCKET_META: Record<DecisionBucket, {
  label: string;
  desc: string;
  tone: string;
  chip: string;
}> = {
  "start-now": {
    label: "Start now",
    desc: "Ready candidates with strong priority and no blocking governance signal.",
    tone: "border-emerald-200 bg-emerald-50/40",
    chip: "border-emerald-200 bg-emerald-100 text-emerald-900",
  },
  "prepare-first": {
    label: "Prepare first",
    desc: "Promising use cases that need design, owner, monitoring, or rollout planning.",
    tone: "border-blue-200 bg-blue-50/40",
    chip: "border-blue-200 bg-blue-100 text-blue-900",
  },
  "governance-review": {
    label: "Governance review",
    desc: "Use cases with active flags, sensitive data, or deployment checks to close.",
    tone: "border-amber-200 bg-amber-50/40",
    chip: "border-amber-200 bg-amber-100 text-amber-900",
  },
  "fix-foundations": {
    label: "Fix foundations",
    desc: "Blocked by hard stops, missing data access, undefined scope, or low readiness.",
    tone: "border-rose-200 bg-rose-50/40",
    chip: "border-rose-200 bg-rose-100 text-rose-900",
  },
};

const HARD_STOP_CODES = new Set([
  "NO_SUCCESS_METRIC",
  "NO_DATA_ACCESS",
  "NO_API",
  "DATA_NOT_ACCESSIBLE",
  "SCOPE_UNDEFINED",
]);

const GOVERNANCE_CODES = new Set([
  "PII_PRESENT",
  "FOREIGN_DATA_ACCESS",
  "HITL_MANDATORY",
  "IRREVERSIBLE_ERRORS",
  "STEP_AUTOMATION_UNSAFE",
]);

export function bucketOf(input: BucketInput): DecisionBucket {
  const codes = input.reasonCodes ?? [];
  const hasHardStop = input.hasHardStop || codes.some((c) => HARD_STOP_CODES.has(c));

  if (hasHardStop || input.quadrant === "foundational-rebuilds" || input.readiness < 45) {
    return "fix-foundations";
  }

  if ((input.govCount ?? 0) > 0 || codes.some((c) => GOVERNANCE_CODES.has(c))) {
    return "governance-review";
  }

  if (input.quadrant === "quick-wins" && input.priority >= 60 && input.readiness >= 60) {
    return "start-now";
  }

  return "prepare-first";
}

export function recommendedActions(input: {
  reasonCodes?: string[];
  gateStatuses?: Record<string, { status?: string }>;
  govCount?: number;
}): RecommendedAction[] {
  const codes = input.reasonCodes ?? [];
  const actions: RecommendedAction[] = [];

  if (codes.some((c) => HARD_STOP_CODES.has(c))) {
    actions.push({
      id: "resolve-hard-stops",
      label: "Resolve hard stops before build",
      why: "The score found missing scope, data access, or success criteria that can invalidate the use case.",
      priority: "now",
    });
  }
  if ((input.govCount ?? 0) > 0 || codes.some((c) => GOVERNANCE_CODES.has(c))) {
    actions.push({
      id: "review-governance",
      label: "Close governance review",
      why: "Sensitive data, human review, or irreversible actions need a named control before deployment.",
      priority: "soon",
    });
  }
  if (codes.includes("NO_PROCESS_OWNER") || codes.includes("MISSING_PROCESS_OWNER")) {
    actions.push({
      id: "assign-owner",
      label: "Assign a process owner",
      why: "A use case cannot move cleanly into pilot without someone accountable for outcomes and exceptions.",
      priority: "soon",
    });
  }
  if (codes.includes("NO_MONITORING_PATH") || codes.includes("MISSING_MONITORING_PLAN")) {
    actions.push({
      id: "define-monitoring",
      label: "Define monitoring",
      why: "Monitoring is needed to catch quality drift, reviewer load, and unsafe automation behavior.",
      priority: "later",
    });
  }
  if (input.gateStatuses?.gate_2?.status === "FAIL") {
    actions.push({
      id: "gate-2",
      label: "Complete Gate 2 deployment checks",
      why: "Deployment needs validation, rollback, monitoring, and human-review controls.",
      priority: "soon",
    });
  }

  return actions;
}
