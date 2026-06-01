import { describe, it, expect } from "vitest";
import { deriveGovernanceFlags } from "./governanceFlags";

function codesOf(flags: ReturnType<typeof deriveGovernanceFlags>) {
  return flags.map((f) => f.rule_code);
}

function severityOf(flags: ReturnType<typeof deriveGovernanceFlags>, code: string) {
  return flags.find((f) => f.rule_code === code)?.severity;
}

describe("deriveGovernanceFlags · EU AI Act", () => {
  it("EU_AI_ACT_HIGH_RISK as hard_stop for finance + material impact", () => {
    const f = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: { impact_if_failure_choice: "critical" },
    });
    expect(severityOf(f, "EU_AI_ACT_HIGH_RISK")).toBe("hard_stop");
  });

  it("EU_AI_ACT_HIGH_RISK as requires_action for partial match", () => {
    const f = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: {},
    });
    expect(severityOf(f, "EU_AI_ACT_HIGH_RISK")).toBe("requires_action");
  });

  it("CONFORMITY_ASSESSMENT only when EU high-risk is hard_stop", () => {
    const high = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: { impact_if_failure_choice: "critical" },
    });
    expect(codesOf(high)).toContain("CONFORMITY_ASSESSMENT");

    const partial = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: {},
    });
    expect(codesOf(partial)).not.toContain("CONFORMITY_ASSESSMENT");
  });

  it("HITL_REQUIRED_ART14 fires from reason code OR capture", () => {
    const fromCode = deriveGovernanceFlags({
      capture: {},
      reasonCodes: ["HITL_MANDATORY"],
    });
    expect(codesOf(fromCode)).toContain("HITL_REQUIRED_ART14");

    const fromCapture = deriveGovernanceFlags({
      capture: { hitl_decisions: "mandatory" },
    });
    expect(codesOf(fromCapture)).toContain("HITL_REQUIRED_ART14");
  });

  it("TRANSPARENCY_ART13 fires from customer_facing_choice", () => {
    const f = deriveGovernanceFlags({
      capture: { customer_facing_choice: "yes" },
    });
    expect(codesOf(f)).toContain("TRANSPARENCY_ART13");
  });

  it("TRANSPARENCY_ART13 fires from target_domain=customer_facing", () => {
    const f = deriveGovernanceFlags({
      capture: { target_domain: "customer_facing" },
    });
    expect(codesOf(f)).toContain("TRANSPARENCY_ART13");
  });

  it("TRANSPARENCY_ART13 does NOT fire for internal-only", () => {
    const f = deriveGovernanceFlags({
      capture: { target_domain: "back_office" },
    });
    expect(codesOf(f)).not.toContain("TRANSPARENCY_ART13");
  });

  it("ARTICLE_11_DOCUMENTATION fires only when stage=production", () => {
    expect(
      codesOf(deriveGovernanceFlags({ capture: {}, stage: "production" })),
    ).toContain("ARTICLE_11_DOCUMENTATION");
    expect(
      codesOf(deriveGovernanceFlags({ capture: {}, stage: "pilot" })),
    ).not.toContain("ARTICLE_11_DOCUMENTATION");
    expect(codesOf(deriveGovernanceFlags({ capture: {} }))).not.toContain(
      "ARTICLE_11_DOCUMENTATION",
    );
  });
});

describe("deriveGovernanceFlags · GDPR", () => {
  it("DPIA_REQUIRED requires personal data AND (automated decisions OR broad processing)", () => {
    const both = deriveGovernanceFlags({
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
      },
    });
    expect(codesOf(both)).toContain("DPIA_REQUIRED");

    const personalOnly = deriveGovernanceFlags({
      capture: { personal_data_choice: "yes" },
    });
    expect(codesOf(personalOnly)).not.toContain("DPIA_REQUIRED");

    const automatedOnly = deriveGovernanceFlags({
      capture: { decision_logic_type: "model_based" },
    });
    expect(codesOf(automatedOnly)).not.toContain("DPIA_REQUIRED");
  });

  it("DATA_MINIMISATION fires on broad scope", () => {
    const f = deriveGovernanceFlags({
      capture: { scope_chips: ["a", "b", "c", "d"] },
    });
    expect(severityOf(f, "DATA_MINIMISATION")).toBe("advisory");
  });

  it("RIGHT_TO_EXPLANATION fires from explicit signal", () => {
    const f = deriveGovernanceFlags({
      capture: { automated_decisions_affect_individuals_choice: "yes" },
    });
    expect(codesOf(f)).toContain("RIGHT_TO_EXPLANATION");
  });

  it("RIGHT_TO_EXPLANATION inferred from personal data + model-based decisions", () => {
    const f = deriveGovernanceFlags({
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
      },
    });
    expect(codesOf(f)).toContain("RIGHT_TO_EXPLANATION");
  });

  it("RIGHT_TO_EXPLANATION does NOT fire without personal data or signal", () => {
    const f = deriveGovernanceFlags({
      capture: { decision_logic_type: "model_based" },
    });
    expect(codesOf(f)).not.toContain("RIGHT_TO_EXPLANATION");
  });
});

describe("deriveGovernanceFlags · Internal policy", () => {
  it("SECURITY_REVIEW_REQUIRED fires from foreign vendor", () => {
    const f = deriveGovernanceFlags({
      capture: { foreign_vendor_choice: "yes" },
    });
    expect(codesOf(f)).toContain("SECURITY_REVIEW_REQUIRED");
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

  it("a maximal trigger set produces all 10 rule codes", () => {
    const f = deriveGovernanceFlags({
      useCaseFunction: "finance",
      capture: {
        personal_data_choice: "yes",
        decision_logic_type: "model_based",
        customer_facing_choice: "yes",
        automated_decisions_affect_individuals_choice: "yes",
        scope_chips: ["a", "b", "c", "d"],
        impact_if_failure_choice: "critical",
        foreign_vendor_choice: "yes",
      },
      reasonCodes: ["HITL_MANDATORY"],
      stage: "production",
      fromStage: "pilot",
    });
    const codes = new Set(codesOf(f));
    expect(codes.has("EU_AI_ACT_HIGH_RISK")).toBe(true);
    expect(codes.has("CONFORMITY_ASSESSMENT")).toBe(true);
    expect(codes.has("HITL_REQUIRED_ART14")).toBe(true);
    expect(codes.has("TRANSPARENCY_ART13")).toBe(true);
    expect(codes.has("ARTICLE_11_DOCUMENTATION")).toBe(true);
    expect(codes.has("DPIA_REQUIRED")).toBe(true);
    expect(codes.has("DATA_MINIMISATION")).toBe(true);
    expect(codes.has("RIGHT_TO_EXPLANATION")).toBe(true);
    expect(codes.has("SECURITY_REVIEW_REQUIRED")).toBe(true);
    expect(codes.has("CHANGE_MANAGEMENT")).toBe(true);
  });
});
