import { describe, it, expect } from "vitest";
import { deriveGovernanceFlags } from "./governanceFlags";

function codesOf(flags: ReturnType<typeof deriveGovernanceFlags>) {
  return flags.map((f) => f.rule_code);
}

function severityOf(flags: ReturnType<typeof deriveGovernanceFlags>, code: string) {
  return flags.find((f) => f.rule_code === code)?.severity;
}

describe("deriveGovernanceFlags · SDAIA", () => {
  it("SDAIA_HIGH_IMPACT_AI as hard_stop for finance + material impact", () => {
    const f = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: { impact_if_failure_choice: "critical" },
    });
    expect(severityOf(f, "SDAIA_HIGH_IMPACT_AI")).toBe("hard_stop");
  });

  it("SDAIA_HIGH_IMPACT_AI as requires_action for partial match", () => {
    const f = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: {},
    });
    expect(severityOf(f, "SDAIA_HIGH_IMPACT_AI")).toBe("requires_action");
  });

  it("SDAIA_MODEL_VALIDATION_REQUIRED only when high-impact AI is hard_stop", () => {
    const high = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: { impact_if_failure_choice: "critical" },
    });
    expect(codesOf(high)).toContain("SDAIA_MODEL_VALIDATION_REQUIRED");

    const partial = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: {},
    });
    expect(codesOf(partial)).not.toContain("SDAIA_MODEL_VALIDATION_REQUIRED");
  });

  it("SDAIA_HUMAN_OVERSIGHT_REQUIRED fires from reason code OR capture", () => {
    const fromCode = deriveGovernanceFlags({
      capture: {},
      reasonCodes: ["HITL_MANDATORY"],
    });
    expect(codesOf(fromCode)).toContain("SDAIA_HUMAN_OVERSIGHT_REQUIRED");

    const fromCapture = deriveGovernanceFlags({
      capture: { hitl_decisions: "mandatory" },
    });
    expect(codesOf(fromCapture)).toContain("SDAIA_HUMAN_OVERSIGHT_REQUIRED");
  });

  it("SDAIA_TRANSPARENCY_REQUIRED fires from customer_facing_choice", () => {
    const f = deriveGovernanceFlags({
      capture: { customer_facing_choice: "yes" },
    });
    expect(codesOf(f)).toContain("SDAIA_TRANSPARENCY_REQUIRED");
  });

  it("SDAIA_TRANSPARENCY_REQUIRED fires from target_domain=customer_facing", () => {
    const f = deriveGovernanceFlags({
      capture: { target_domain: "customer_facing" },
    });
    expect(codesOf(f)).toContain("SDAIA_TRANSPARENCY_REQUIRED");
  });

  it("SDAIA_TRANSPARENCY_REQUIRED does NOT fire for internal-only", () => {
    const f = deriveGovernanceFlags({
      capture: { target_domain: "back_office" },
    });
    expect(codesOf(f)).not.toContain("SDAIA_TRANSPARENCY_REQUIRED");
  });

  it("SDAIA_TECHNICAL_DOCUMENTATION fires only when stage=production", () => {
    expect(
      codesOf(deriveGovernanceFlags({ capture: {}, stage: "production" })),
    ).toContain("SDAIA_TECHNICAL_DOCUMENTATION");
    expect(
      codesOf(deriveGovernanceFlags({ capture: {}, stage: "pilot" })),
    ).not.toContain("SDAIA_TECHNICAL_DOCUMENTATION");
    expect(codesOf(deriveGovernanceFlags({ capture: {} }))).not.toContain(
      "SDAIA_TECHNICAL_DOCUMENTATION",
    );
  });
});

describe("deriveGovernanceFlags · PDPL / NDMO", () => {
  it("PDPL_PRIVACY_IMPACT_REVIEW requires personal data AND (automated decisions OR broad processing)", () => {
    const both = deriveGovernanceFlags({
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
      },
    });
    expect(codesOf(both)).toContain("PDPL_PRIVACY_IMPACT_REVIEW");

    const personalOnly = deriveGovernanceFlags({
      capture: { personal_data_choice: "yes" },
    });
    expect(codesOf(personalOnly)).not.toContain("PDPL_PRIVACY_IMPACT_REVIEW");

    const automatedOnly = deriveGovernanceFlags({
      capture: { decision_logic_type: "model_based" },
    });
    expect(codesOf(automatedOnly)).not.toContain("PDPL_PRIVACY_IMPACT_REVIEW");
  });

  it("PDPL_DATA_MINIMISATION fires on broad scope", () => {
    const f = deriveGovernanceFlags({
      capture: { scope_chips: ["a", "b", "c", "d"] },
    });
    expect(severityOf(f, "PDPL_DATA_MINIMISATION")).toBe("advisory");
  });

  it("PDPL_PRIVACY_IMPACT_REVIEW fires from explicit automated-decision signal", () => {
    const f = deriveGovernanceFlags({
      capture: { automated_decisions_affect_individuals_choice: "yes" },
    });
    expect(codesOf(f)).toContain("PDPL_PRIVACY_IMPACT_REVIEW");
  });

  it("PDPL_PRIVACY_IMPACT_REVIEW inferred from personal data + model-based decisions", () => {
    const f = deriveGovernanceFlags({
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
      },
    });
    expect(codesOf(f)).toContain("PDPL_PRIVACY_IMPACT_REVIEW");
  });

  it("PDPL_PRIVACY_IMPACT_REVIEW does NOT fire without personal data or signal", () => {
    const f = deriveGovernanceFlags({
      capture: { decision_logic_type: "model_based" },
    });
    expect(codesOf(f)).not.toContain("PDPL_PRIVACY_IMPACT_REVIEW");
  });

  it("NDMO_DATA_GOVERNANCE_REVIEW fires on restricted data", () => {
    const f = deriveGovernanceFlags({
      capture: { classification: "restricted" },
    });
    expect(severityOf(f, "NDMO_DATA_GOVERNANCE_REVIEW")).toBe("requires_action");
  });
});

describe("deriveGovernanceFlags · Internal policy", () => {
  it("SECURITY_REVIEW_REQUIRED fires from foreign vendor", () => {
    const f = deriveGovernanceFlags({
      capture: { foreign_vendor_choice: "yes" },
    });
    expect(codesOf(f)).toContain("SECURITY_REVIEW_REQUIRED");
    expect(codesOf(f)).toContain("NCA_SAMA_SECURITY_REVIEW");
  });

  it("SECURITY_REVIEW_REQUIRED fires from 3+ integrations", () => {
    const f = deriveGovernanceFlags({
      capture: { integration_count: 4 },
    });
    expect(codesOf(f)).toContain("SECURITY_REVIEW_REQUIRED");
  });

  it("CHANGE_MANAGEMENT only on Pilot → Production", () => {
    expect(
      codesOf(
        deriveGovernanceFlags({
          capture: {},
          fromStage: "pilot",
          stage: "production",
        }),
      ),
    ).toContain("CHANGE_MANAGEMENT");

    expect(
      codesOf(
        deriveGovernanceFlags({
          capture: {},
          fromStage: "backlog",
          stage: "production",
        }),
      ),
    ).not.toContain("CHANGE_MANAGEMENT");

    expect(
      codesOf(
        deriveGovernanceFlags({
          capture: {},
          fromStage: "pilot",
          stage: "scaling",
        }),
      ),
    ).not.toContain("CHANGE_MANAGEMENT");
  });
});

describe("deriveGovernanceFlags · idempotence + integration", () => {
  it("re-deriving with the same input yields the same flag set", () => {
    const input = {
      useCaseFunction: "finance",
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
        customer_facing_choice: "yes",
        scope_chips: ["a", "b", "c", "d"],
        impact_if_failure_choice: "critical",
      },
      reasonCodes: ["HITL_MANDATORY"],
      stage: "production" as const,
      fromStage: "pilot" as const,
    };
    const first = codesOf(deriveGovernanceFlags(input)).sort();
    const second = codesOf(deriveGovernanceFlags(input)).sort();
    expect(first).toEqual(second);
  });

  it("a maximal trigger set produces the expected KSA rule codes", () => {
    const f = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
        customer_facing_choice: "yes",
        automated_decisions_affect_individuals_choice: "yes",
        scope_chips: ["a", "b", "c", "d"],
        impact_if_failure_choice: "critical",
        classification: "restricted",
        foreign_vendor_choice: "yes",
      },
      reasonCodes: ["HITL_MANDATORY"],
      stage: "production",
      fromStage: "pilot",
    });
    const codes = new Set(codesOf(f));
    expect(codes.has("SDAIA_HIGH_IMPACT_AI")).toBe(true);
    expect(codes.has("SDAIA_MODEL_VALIDATION_REQUIRED")).toBe(true);
    expect(codes.has("SDAIA_HUMAN_OVERSIGHT_REQUIRED")).toBe(true);
    expect(codes.has("SDAIA_TRANSPARENCY_REQUIRED")).toBe(true);
    expect(codes.has("SDAIA_TECHNICAL_DOCUMENTATION")).toBe(true);
    expect(codes.has("PDPL_PRIVACY_IMPACT_REVIEW")).toBe(true);
    expect(codes.has("PDPL_DATA_MINIMISATION")).toBe(true);
    expect(codes.has("PDPL_CROSS_BORDER_REVIEW")).toBe(true);
    expect(codes.has("NDMO_DATA_GOVERNANCE_REVIEW")).toBe(true);
    expect(codes.has("NCA_SAMA_SECURITY_REVIEW")).toBe(true);
    expect(codes.has("SECURITY_REVIEW_REQUIRED")).toBe(true);
    expect(codes.has("CHANGE_MANAGEMENT")).toBe(true);
  });
});
