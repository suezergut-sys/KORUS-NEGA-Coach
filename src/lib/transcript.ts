export type TranscriptTurn = {
  id: string;
  author: "Вы" | "Оппонент";
  text: string;
  time: string;
};

export const MIN_USER_TURNS_FOR_ANALYSIS = 3;
export const INSUFFICIENT_ANALYSIS_MESSAGE = "Недостаточно данных для анализа. Произнесите минимум три отдельные реплики со своей стороны.";

export function countUserTurns(turns: Array<{ author: unknown; text?: unknown }>) {
  return turns.filter((turn) => turn.author === "Вы" && typeof turn.text === "string" && turn.text.trim().length > 0).length;
}

export function hasEnoughUserTurnsForAnalysis(turns: Array<{ author: unknown; text?: unknown }>) {
  return countUserTurns(turns) >= MIN_USER_TURNS_FOR_ANALYSIS;
}

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
