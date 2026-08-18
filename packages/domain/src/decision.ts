import type { RiskLevel, UserQuestion } from "./types";

const principlePatterns = [
  /deploy|production|publish|release/i,
  /delete|destroy|overwrite|reset|irreversible/i,
  /credential|secret|token|permission|access/i,
  /purchase|payment|cost|billing|paid/i,
  /legal|compliance|privacy|personal data/i,
  /scope|acceptance criteria|product direction/i,
];

export interface DecisionClassification {
  riskLevel: RiskLevel;
  requiresUser: boolean;
  answer?: string;
  reason: string;
}

export function classifyDecision(question: UserQuestion): DecisionClassification {
  const body = `${question.question} ${question.context ?? ""}`;
  const riskLevel = question.riskLevel ?? (principlePatterns.some((pattern) => pattern.test(body)) ? "L3" : "L1");
  if (riskLevel === "L3") {
    return { riskLevel, requiresUser: true, reason: question.reason ?? "This choice changes a principle-level boundary." };
  }
  const answer = question.recommendation ?? question.choices?.[0];
  if (!answer) return { riskLevel: "L3", requiresUser: true, reason: "No safe default could be inferred." };
  return { riskLevel, requiresUser: false, answer, reason: question.reason ?? "Selected the recommended reversible option." };
}
