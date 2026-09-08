import { describe, expect, it } from "vitest";
import { analysisRubricForCase, applyAntiPatternPenalty, applyOneCDismissalSafetyPolicy, applyServerRubric, NEGOTIATION_RUBRIC, ONE_C_DISMISSAL_RUBRIC } from "../src/lib/analysis-rubric";
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

  it("deducts four control points for each unique confirmed anti-pattern", () => {
    const input = applyServerRubric(analysis());
    input.antiPatterns = [
      { methodologyAtomId: "a", name: "Давление", turnQuote: "Подпиши сейчас", explanation: "Риск" },
      { methodologyAtomId: "b", name: "Угроза", turnQuote: "Будет хуже", explanation: "Риск" },
      { methodologyAtomId: "a", name: "Давление", turnQuote: "Сейчас", explanation: "Риск" },
    ];
    const result = applyAntiPatternPenalty(input);
    expect(result.scoreBreakdown.find((item) => item.id === "control")?.score).toBe(0);
    expect(result.scoreBreakdown.find((item) => item.id === "control")?.explanation).toContain("штраф −7 из 20");
    expect(result.overallScore).toBe(42);
  });

  it("uses four independent 25-point scales for the 1C dismissal case", () => {
    expect(analysisRubricForCase("1c-dismissal")).toEqual(ONE_C_DISMISSAL_RUBRIC);
    const input = analysis();
    input.scoreBreakdown = ONE_C_DISMISSAL_RUBRIC.map((item) => ({ ...item, score: 25, explanation: "E" }));
    const result = applyServerRubric(input, ONE_C_DISMISSAL_RUBRIC);
    expect(result.overallScore).toBe(100);
    expect(result.scoreBreakdown.map((item) => item.id)).toEqual(["structure", "tone", "legal", "next_step"]);
  });

  it("does not let legal red flags be masked by a strong formal structure", () => {
    const input = analysis();
    input.scoreBreakdown = ONE_C_DISMISSAL_RUBRIC.map((item) => ({ ...item, score: 25, explanation: "E" }));
    input.laborLawRisks = [{ referenceId: "worse-dismissal", turnQuote: "Если не подпишешь", dangerousPhrase: "Если не подпишешь соглашение, уволим хуже", risk: "Прямое давление", articles: "ст. 78" }];
    const result = applyOneCDismissalSafetyPolicy(applyServerRubric(input, ONE_C_DISMISSAL_RUBRIC));
    expect(result.overallScore).toBe(29);
    expect(result.scoreBreakdown.reduce((sum, item) => sum + item.score, 0)).toBe(29);
    expect(result.scoreBreakdown.some((item) => item.explanation.includes("политике безопасности кейса"))).toBe(true);
  });

  it("limits an unsafe management tone without reducing the independent legal scale", () => {
    const input = analysis();
    input.scoreBreakdown = ONE_C_DISMISSAL_RUBRIC.map((item) => ({ ...item, score: 25, explanation: "E" }));
    input.antiPatterns = [{ methodologyAtomId: "a", name: "Обесценивание", turnQuote: "Компания не благотворительность", explanation: "Недопустимый тон" }];
    const result = applyOneCDismissalSafetyPolicy(applyAntiPatternPenalty(applyServerRubric(input, ONE_C_DISMISSAL_RUBRIC)));
    expect(result.overallScore).toBe(59);
    expect(result.scoreBreakdown.find((item) => item.id === "legal")?.score).toBe(25);
    expect(result.scoreBreakdown.find((item) => item.id === "tone")?.score).toBe(0);
  });
});
