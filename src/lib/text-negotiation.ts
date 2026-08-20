import type { TranscriptTurn } from "@/lib/transcript";

export const TEXT_NEGOTIATION_MODEL = process.env.OPENAI_TEXT_NEGOTIATION_MODEL || "gpt-5.4-mini";
export const TEXT_NEGOTIATION_MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export function textNegotiationInput(turns: TranscriptTurn[], startOpponent = false) {
  if (startOpponent) {
    return "Приложение явно запрашивает первую реплику AI-оппонента. Начни переговоры сейчас по стартовому контракту.";
  }

  return turns.slice(-60).map((turn) => ({
    role: turn.author === "Вы" ? "user" as const : "assistant" as const,
    content: turn.text,
  }));
}

export function validateTextNegotiationAudio(value: FormDataEntryValue | null) {
  if (!(value instanceof File)) throw new Error("Запишите голосовую реплику.");
  if (!value.size) throw new Error("Запись получилась пустой.");
  if (value.size > TEXT_NEGOTIATION_MAX_AUDIO_BYTES) throw new Error("Голосовая реплика слишком большая. Запишите её короче.");
  if (!value.type.startsWith("audio/")) throw new Error("Не удалось распознать формат голосовой реплики.");
  return value;
}
