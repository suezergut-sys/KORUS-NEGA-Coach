export type TranscriptTurn = {
  id: string;
  author: "Вы" | "Оппонент";
  text: string;
  time: string;
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeAnalysisTurns(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((turn): turn is Record<string, unknown> => Boolean(turn && typeof turn === "object"))
    .map((turn) => ({
      id: clean(turn.id, 120),
      author: turn.author,
      text: clean(turn.text, 2000),
      time: clean(turn.time, 20),
    }))
    .filter((turn): turn is TranscriptTurn => Boolean(turn.text && (turn.author === "Вы" || turn.author === "Оппонент")));
}

export function formatAnalysisTranscript(turns: TranscriptTurn[]) {
  return turns.map((turn, index) => `${index + 1}. ${turn.author}: ${turn.text}`).join("\n");
}
