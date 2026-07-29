export function averageLatestScores(scoresNewestFirst: Array<number | null>, limit = 10) {
  const scores = scoresNewestFirst.slice(0, limit).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

const SKILL_LABELS = new Map([
  ["goal", "Продвижение к цели"],
  ["interests", "Разведка и работа с интересами"],
  ["control", "Управление позицией и ходом разговора"],
  ["value", "Аргументация, обмены и создание ценности"],
  ["agreement", "Конкретность и качество договорённостей"],
]);

export type CalculatedSkillProgress = {
  id: string;
  label: string;
  average: number;
  latest: number;
  delta: number | null;
  attempts: number;
};

export function calculateSkillProgress(
  evaluationsNewestFirst: Array<{ scoreBreakdown?: Array<{ id?: unknown; score?: unknown }> } | null>,
): CalculatedSkillProgress[] {
  const values = new Map<string, number[]>();
  for (const evaluation of evaluationsNewestFirst) {
    for (const item of evaluation?.scoreBreakdown || []) {
      if (typeof item.id !== "string" || !SKILL_LABELS.has(item.id)) continue;
      const score = Number(item.score);
      if (!Number.isFinite(score)) continue;
      const current = values.get(item.id) || [];
      current.push(Math.min(20, Math.max(0, Math.round(score))));
      values.set(item.id, current);
    }
  }
  return [...values.entries()].map(([id, scores]) => ({
    id,
    label: SKILL_LABELS.get(id) || id,
    average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    latest: scores[0],
    delta: scores.length > 1 ? scores[0] - scores[1] : null,
    attempts: scores.length,
  })).sort((left, right) => left.average - right.average);
}
