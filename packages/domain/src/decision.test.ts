import { describe, expect, it } from "vitest";
import { classifyDecision } from "./decision";

describe("decision policy", () => {
  it("auto-selects reversible recommendations", () => {
    expect(classifyDecision({ question: "Which test runner?", choices: ["Vitest", "Jest"], recommendation: "Vitest" })).toMatchObject({ requiresUser: false, answer: "Vitest" });
  });

  it("escalates production deployment", () => {
    expect(classifyDecision({ question: "Deploy to production?", choices: ["Yes", "No"] })).toMatchObject({ requiresUser: true, riskLevel: "L3" });
  });
});
