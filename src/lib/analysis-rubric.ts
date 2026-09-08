import type { NegotiationAnalysis } from "@/lib/analysis-types";

export const NEGOTIATION_RUBRIC = [
  { id: "goal", criterion: "Продвижение к цели", maxScore: 20 },
  { id: "interests", criterion: "Разведка и работа с интересами", maxScore: 20 },
  { id: "control", criterion: "Управление позицией и ходом разговора", maxScore: 20 },
  { id: "value", criterion: "Аргументация, обмены и создание ценности", maxScore: 20 },
  { id: "agreement", criterion: "Конкретность и качество договорённостей", maxScore: 20 },
] as const;

export const ONE_C_DISMISSAL_RUBRIC = [
  { id: "structure", criterion: "Переговорная структура", maxScore: 25 },
  { id: "tone", criterion: "Управленческий тон", maxScore: 25 },
  { id: "legal", criterion: "Юридическая безопасность", maxScore: 25 },
  { id: "next_step", criterion: "Качество следующего шага", maxScore: 25 },
] as const;

export type NegotiationRubric = ReadonlyArray<{ id: NegotiationAnalysis["scoreBreakdown"][number]["id"]; criterion: string; maxScore: number }>;

export function analysisRubricForCase(caseCode: string): NegotiationRubric {
  return caseCode === "1c-dismissal" ? ONE_C_DISMISSAL_RUBRIC : NEGOTIATION_RUBRIC;
}

type RubricId = NegotiationAnalysis["scoreBreakdown"][number]["id"];

function boundedInteger(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function applyServerRubric(analysis: NegotiationAnalysis, rubricDefinition: NegotiationRubric = NEGOTIATION_RUBRIC): NegotiationAnalysis {
  const byId = new Map(analysis.scoreBreakdown.map((item) => [item.id, item]));
  const scoreBreakdown = rubricDefinition.map((rubric) => {
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

export const ANTI_PATTERN_PENALTY = 4;

export function applyAntiPatternPenalty(analysis: NegotiationAnalysis): NegotiationAnalysis {
  const count = new Set((analysis.antiPatterns || []).map((item) => item.methodologyAtomId)).size;
  if (!count) return analysis;
  const requestedPenalty = count * ANTI_PATTERN_PENALTY;
  const scoreBreakdown = analysis.scoreBreakdown.map((item) => {
    if (item.id !== (analysis.scoreBreakdown.some((candidate) => candidate.id === "tone") ? "tone" : "control")) return item;
    const penalty = Math.min(item.score, requestedPenalty);
    return {
      ...item,
      score: item.score - penalty,
      explanation: `${item.explanation} Подтверждённые антиприёмы: ${count}; штраф −${penalty} из ${item.maxScore}.`.trim(),
    };
  });
  return { ...analysis, scoreBreakdown, overallScore: scoreBreakdown.reduce((sum, item) => sum + item.score, 0) };
}

export function applyOneCDismissalSafetyPolicy(analysis: NegotiationAnalysis): NegotiationAnalysis {
  const legalRiskCount = analysis.laborLawRisks?.length || 0;
  const antiPatternCount = new Set((analysis.antiPatterns || []).map((item) => item.methodologyAtomId)).size;
  const cap = legalRiskCount ? 29 : antiPatternCount ? 59 : 100;
  const currentTotal = analysis.scoreBreakdown.reduce((sum, item) => sum + item.score, 0);
  if (currentTotal <= cap) return { ...analysis, overallScore: currentTotal };

  let remainingPenalty = currentTotal - cap;
  const priority = legalRiskCount
    ? ["legal", "tone", "next_step", "structure", "control", "agreement", "value", "goal", "interests"]
    : ["tone", "next_step", "structure", "legal", "control", "agreement", "value", "goal", "interests"];
  const scoreBreakdown = analysis.scoreBreakdown.map((item) => ({ ...item }));
  for (const id of priority) {
    const item = scoreBreakdown.find((candidate) => candidate.id === id);
    if (!item || remainingPenalty <= 0) continue;
    const penalty = Math.min(item.score, remainingPenalty);
    item.score -= penalty;
    item.explanation = `${item.explanation} Автоматическое ограничение итогового балла по политике безопасности кейса: −${penalty}.`.trim();
    remainingPenalty -= penalty;
  }
  return { ...analysis, scoreBreakdown, overallScore: scoreBreakdown.reduce((sum, item) => sum + item.score, 0) };
}
