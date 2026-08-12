export const INTERRUPTION_TRANSCRIPT_CONFIRMATION_DELAY_MS = 3000;

export type RealtimeInterruptionCandidate = {
  itemId: string;
  responseId: string;
  transcriptVersion: number;
  startedAt: number;
  durationMs: number | null;
  wasAudible: boolean;
};

const NON_SPEECH_TRANSCRIPTS = new Set([
  "шум",
  "фоновый шум",
  "посторонний шум",
  "тишина",
  "музыка",
  "кашель",
  "смех",
  "вздох",
  "неразборчиво",
  "неразборчивая речь",
]);

export function isMeaningfulUserSpeechTranscript(transcript: string) {
  const normalized = transcript
    .toLocaleLowerCase("ru-RU")
    .replace(/[«»"'`\[\](){}.,!?…:;—–-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return /[\p{L}\p{N}]/u.test(normalized) && !NON_SPEECH_TRANSCRIPTS.has(normalized);
}

export function shouldConfirmRealtimeInterruption(
  candidate: RealtimeInterruptionCandidate | null,
  transcript: string,
) {
  return candidate !== null && candidate.wasAudible && isMeaningfulUserSpeechTranscript(transcript);
}
