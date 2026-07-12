export function averageLatestScores(scoresNewestFirst: Array<number | null>, limit = 10) {
  const scores = scoresNewestFirst.slice(0, limit).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}
