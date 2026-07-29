import { describe, expect, it } from "vitest";
import { applyServerRubric, NEGOTIATION_RUBRIC } from "../src/lib/analysis-rubric";
import type { NegotiationAnalysis } from "../src/lib/analysis-types";

function analysis(): NegotiationAnalysis {
  return {
    methodologyStatus: "verified",
    methodologyVersion: "v1",
    overallScore: 99,
    summary: "Итог",
    outcome: { winner: "draw", verdict: "Равновесие", reasons: ["A", "B"], confidence: 1.4 },
    personalFeedback: "Обратная связь",
    scoreBreakdown: [
      { id: "agreement", criterion: "Подмена", score: 23, maxScore: 20, explanation: "E" },
      { id: "goal", criterion: "Подмена", score: 10, maxScore: 20, explanation: "E" },
      { id: "value", criterion: "Подмена", score: -2, maxScore: 20, explanation: "E" },
      { id: "interests", criterion: "Подмена", score: 11.6, maxScore: 20, explanation: "E" },
      { id: "control", criterion: "Подмена", score: 7, maxScore: 20, explanation: "E" },
    ],
    strengths: [],
    risks: [],
    turningPoints: [],
    stratagems: [],
    alternatives: ["A", "B"],
    techniqueReview: [],
    developmentPlan: [],
    evidence: [],
    disclaimer: "ИИ-анализ",
  };
}

describe("server-owned negotiation rubric", () => {
  it("uses canonical ordering, labels, bounds and total", () => {
    const result = applyServerRubric(analysis());
    expect(result.scoreBreakdown.map((item) => item.id)).toEqual(NEGOTIATION_RUBRIC.map((item) => item.id));
    expect(result.scoreBreakdown.map((item) => item.criterion)).toEqual(NEGOTIATION_RUBRIC.map((item) => item.criterion));
    expect(result.scoreBreakdown.map((item) => item.score)).toEqual([10, 12, 7, 0, 20]);
    expect(result.overallScore).toBe(49);
    expect(result.outcome.confidence).toBe(1);
  });

  it("rejects an incomplete model response", () => {
    const input = analysis();
    input.scoreBreakdown = input.scoreBreakdown.filter((item) => item.id !== "control");
    expect(() => applyServerRubric(input)).toThrow(/control/);
  });
});
