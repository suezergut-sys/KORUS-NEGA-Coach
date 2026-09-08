export type AnalysisScoreBand = "red" | "yellow" | "green";

export function analysisScoreBand(score: number): { id: AnalysisScoreBand; label: string } {
  const bounded = Math.min(100, Math.max(0, Number(score) || 0));
  if (bounded < 30) return { id: "red", label: "Красная зона" };
  if (bounded < 60) return { id: "yellow", label: "Жёлтая зона" };
  return { id: "green", label: "Зелёная зона" };
}
