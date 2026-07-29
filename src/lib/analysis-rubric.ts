import type { NegotiationAnalysis } from "@/lib/analysis-types";

export const NEGOTIATION_RUBRIC = [
  { id: "goal", criterion: "Продвижение к цели", maxScore: 20 },
  { id: "interests", criterion: "Разведка и работа с интересами", maxScore: 20 },
  { id: "control", criterion: "Управление позицией и ходом разговора", maxScore: 20 },
  { id: "value", criterion: "Аргументация, обмены и создание ценности", maxScore: 20 },
  { id: "agreement", criterion: "Конкретность и качество договорённостей", maxScore: 20 },
] as const;

type RubricId = (typeof NEGOTIATION_RUBRIC)[number]["id"];

function boundedInteger(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function applyServerRubric(analysis: NegotiationAnalysis): NegotiationAnalysis {
  const byId = new Map(analysis.scoreBreakdown.map((item) => [item.id, item]));
  const scoreBreakdown = NEGOTIATION_RUBRIC.map((rubric) => {
    const candidate = byId.get(rubric.id as RubricId);
    if (!candidate) throw new Error(`Модель не вернула критерий рубрики: ${rubric.id}.`);
    return {
      id: rubric.id,
      criterion: rubric.criterion,
      score: boundedInteger(candidate.score, 0, rubric.maxScore),
      maxScore: rubric.maxScore,
      explanation: String(candidate.explanation || "").trim(),
    };
  });

  return {
    ...analysis,
    overallScore: scoreBreakdown.reduce((sum, item) => sum + item.score, 0),
    outcome: {
      ...analysis.outcome,
      confidence: Math.min(1, Math.max(0, Number(analysis.outcome.confidence) || 0)),
    },
    scoreBreakdown,
  };
}
