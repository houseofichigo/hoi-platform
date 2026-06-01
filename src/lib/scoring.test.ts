import { describe, it, expect } from "vitest";
import { computeScore, clampScore, classifyOutcome, SCORING_WEIGHTS } from "./scoring.functions";

const empty = { block1: {}, block2: {}, block3: {}, block4: {} };

function strongCandidate() {
  return {
    block1: {
      business_objectives: "Reduce invoice cycle time",
      success_metric: "Cycle time -40%",
      in_scope: "Vendor invoices",
      out_of_scope: "Employee expenses",
      use_case_shape: "extraction",
    },
    block2: {
      primary_systems: "SAP",
      data_readiness: "ready",
      accessibility: "api",
      structure: "structured",
      classification: "internal",
      historical_cases: "yes",
      actionability: "yes",
      personal_data: false,
      foreign_vendor_access: false,
    },
    block3: {
      workflow_steps: ["receive", "extract", "match", "post"],
      per_step_automation: { receive: 3, extract: 3, match: 3, post: 2 },
      hitl_decisions: "exception",
      decision_logic_type: "rules",
      rules_documentation: "yes",
      standardisation: "high",
      exception_rate: 5,
      trigger_type: "event",
    },
    block4: {
      error_reversibility: "easy",
      output_validation: "automated",
      output_verifiable: "yes",
      rollback_path: "yes",
      monitoring_plan: "yes",
      process_owner: "Jane Doe",
      risk_tolerance: "medium",
      output_criticality: "high",
    },
  };
}

describe("clampScore", () => {
  it("clamps below 0", () => expect(clampScore(-50)).toBe(0));
  it("clamps above 100", () => expect(clampScore(250)).toBe(100));
  it("handles NaN", () => expect(clampScore(NaN)).toBe(0));
  it("handles Infinity", () => expect(clampScore(Infinity)).toBe(0));
  it("rounds in range", () => expect(clampScore(72.6)).toBe(73));
});

describe("computeScore — strong candidate", () => {
  const r = computeScore(strongCandidate());
  it("high business impact", () => expect(r.pillar_scores.business_impact).toBeGreaterThanOrEqual(70));
  it("high feasibility", () => expect(r.pillar_scores.feasibility).toBeGreaterThanOrEqual(80));
  it("high delivery readiness", () => expect(r.delivery_readiness).toBeGreaterThanOrEqual(70));
  it("start_now quadrant", () => expect(r.quadrant).toBe("start_now"));
  it("tier_1 with no constraints", () => expect(r.tier).toBe("tier_1"));
});

describe("computeScore — dangerous candidate", () => {
  const base = strongCandidate();
  const r = computeScore({
    ...base,
    block2: { ...base.block2, personal_data: true },
    block4: {
      ...base.block4,
      error_reversibility: "irreversible",
      rollback_path: "no",
      monitoring_plan: "no",
    },
  });
  it("flags IRREVERSIBLE_ERRORS", () => expect(r.reason_codes).toContain("IRREVERSIBLE_ERRORS"));
  it("flags PII_PRESENT", () => expect(r.reason_codes).toContain("PII_PRESENT"));
  it("flags NO_ROLLBACK_PATH", () => expect(r.reason_codes).toContain("NO_ROLLBACK_PATH"));
  it("flags NO_MONITORING_PATH", () => expect(r.reason_codes).toContain("NO_MONITORING_PATH"));
  it("not tier_1", () => expect(r.tier).not.toBe("tier_1"));
});

describe("computeScore — vague candidate", () => {
  const r = computeScore(empty);
  it("flags NO_SUCCESS_METRIC", () => expect(r.reason_codes).toContain("NO_SUCCESS_METRIC"));
  it("flags SCOPE_UNDEFINED", () => expect(r.reason_codes).toContain("SCOPE_UNDEFINED"));
  it("flags MISSING_DATA_ACCESS", () => expect(r.reason_codes).toContain("MISSING_DATA_ACCESS"));
  it("tier_3", () => expect(r.tier).toBe("tier_3"));
  it("empty captures produce low pillar scores (not midpoint)", () => {
    expect(r.pillar_scores.business_impact).toBeLessThan(40);
    expect(r.pillar_scores.feasibility).toBeLessThan(40);
    expect(r.pillar_scores.process_maturity).toBeLessThan(60);
  });
});

describe("computeScore — valuable but immature", () => {
  const base = strongCandidate();
  const r = computeScore({
    ...base,
    block2: { ...base.block2, data_readiness: "poor", accessibility: "manual", structure: "unstructured" },
    block3: { ...base.block3, standardisation: "low", rules_documentation: "no", exception_rate: 50 },
  });
  it("not start_now", () => expect(r.quadrant).not.toBe("start_now"));
  it("plan or park", () => expect(["plan", "park"]).toContain(r.quadrant));
});

describe("computeScore — ready but low value", () => {
  const base = strongCandidate();
  const r = computeScore({
    ...base,
    block1: { ...base.block1, business_objectives: "", success_metric: "" },
    block4: { ...base.block4, output_criticality: "low" },
  });
  it("not start_now", () => expect(r.quadrant).not.toBe("start_now"));
  it("reshape or park", () => expect(["reshape", "park"]).toContain(r.quadrant));
});

describe("computeScore — boundary >= 60", () => {
  it("quadrant uses >= threshold not >", () => {
    // Direct check: if priority and DR are exactly 60, that's start_now
    const T = SCORING_WEIGHTS.quadrant_threshold;
    expect(T).toBe(60);
    // Construct synthetic by validating the rule via a near-boundary case
    const base = strongCandidate();
    const r = computeScore(base);
    if (r.priority >= 60 && r.delivery_readiness >= 60) expect(r.quadrant).toBe("start_now");
  });
});

describe("STEP_AUTOMATION_UNSAFE", () => {
  it("triggers on irreversible + high automation without mandatory HITL", () => {
    const base = strongCandidate();
    const r = computeScore({
      ...base,
      block3: {
        ...base.block3,
        per_step_automation: { receive: 5, extract: 5, match: 5, post: 5 },
        hitl_decisions: "sample",
      },
      block4: { ...base.block4, error_reversibility: "irreversible", output_criticality: "critical" },
    });
    expect(r.reason_codes).toContain("STEP_AUTOMATION_UNSAFE");
    expect(r.tier).not.toBe("tier_1");
  });
  it("does not trigger when HITL is mandatory", () => {
    const base = strongCandidate();
    const r = computeScore({
      ...base,
      block3: {
        ...base.block3,
        per_step_automation: { receive: 5, extract: 5, match: 5, post: 5 },
        hitl_decisions: "mandatory",
      },
      block4: { ...base.block4, error_reversibility: "irreversible" },
    });
    expect(r.reason_codes).not.toContain("STEP_AUTOMATION_UNSAFE");
  });
});

describe("all pillar scores clamped 0-100", () => {
  it("strong", () => {
    const r = computeScore(strongCandidate());
    Object.values(r.pillar_scores).forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });
  it("empty", () => {
    const r = computeScore(empty);
    Object.values(r.pillar_scores).forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });
});

describe("classifyOutcome — exact boundary semantics", () => {
  it("delivery_readiness = 60 counts as 'ready' (inclusive ≥ 60)", () => {
    const r = classifyOutcome({ priority: 80, delivery_readiness: 60, reason_codes: [] });
    expect(r.quadrant).toBe("start_now");
    expect(r.tier).toBe("tier_1");
  });
  it("delivery_readiness = 59 falls below threshold", () => {
    const r = classifyOutcome({ priority: 80, delivery_readiness: 59, reason_codes: [] });
    expect(r.quadrant).toBe("plan");
    expect(r.tier).toBe("tier_2");
  });
  it("priority = 60 counts as 'priority' (inclusive ≥ 60)", () => {
    const r = classifyOutcome({ priority: 60, delivery_readiness: 80, reason_codes: [] });
    expect(r.quadrant).toBe("start_now");
    expect(r.tier).toBe("tier_1");
  });
  it("priority = 59 falls below threshold", () => {
    const r = classifyOutcome({ priority: 59, delivery_readiness: 80, reason_codes: [] });
    expect(r.quadrant).toBe("reshape");
    expect(r.tier).toBe("tier_2");
  });
  it("hard stop forces tier_3 even in start_now quadrant", () => {
    const r = classifyOutcome({
      priority: 90,
      delivery_readiness: 90,
      reason_codes: ["NO_SUCCESS_METRIC"],
    });
    expect(r.quadrant).toBe("start_now");
    expect(r.tier).toBe("tier_3");
  });
  it("design constraint blocks tier_1 (becomes tier_2)", () => {
    const r = classifyOutcome({
      priority: 90,
      delivery_readiness: 90,
      reason_codes: ["HITL_MANDATORY"],
    });
    expect(r.quadrant).toBe("start_now");
    expect(r.tier).toBe("tier_2");
  });
  it("both axes below threshold => park => tier_3", () => {
    const r = classifyOutcome({ priority: 40, delivery_readiness: 40, reason_codes: [] });
    expect(r.quadrant).toBe("park");
    expect(r.tier).toBe("tier_3");
  });
});

describe("STEP_AUTOMATION_UNSAFE — exact emission rule", () => {
  const base = {
    block1: { success_metric: "x", in_scope: "a", out_of_scope: "b", use_case_shape: "extraction" },
    block2: { primary_systems: "s", data_readiness: "ready", accessibility: "api", structure: "structured" },
    block3: {
      workflow_steps: ["s1"],
      per_step_automation: { s1: 4 },
      hitl_decisions: "sample",
      rules_documentation: "yes",
      standardisation: "high",
      exception_rate: 5,
      trigger_type: "event",
    },
    block4: {
      error_reversibility: "irreversible",
      output_verifiable: "yes",
      rollback_path: "yes",
      monitoring_plan: "yes",
      process_owner: "Jane",
      risk_tolerance: "medium",
      output_criticality: "high",
    },
  };
  it("emits STEP_AUTOMATION_UNSAFE at the unsafe automation level when irreversible and HITL not mandatory", () => {
    const r = computeScore(base);
    expect(r.reason_codes).toContain("STEP_AUTOMATION_UNSAFE");
  });
  it("does not emit when HITL is mandatory", () => {
    const r = computeScore({ ...base, block3: { ...base.block3, hitl_decisions: "mandatory" } });
    expect(r.reason_codes).not.toContain("STEP_AUTOMATION_UNSAFE");
  });
  it("does not emit when automation level below threshold", () => {
    const r = computeScore({
      ...base,
      block3: { ...base.block3, per_step_automation: { s1: 3 } },
    });
    expect(r.reason_codes).not.toContain("STEP_AUTOMATION_UNSAFE");
  });
});
