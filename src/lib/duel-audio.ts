export const DUEL_AUDIO_MAX_BYTES = 25 * 1024 * 1024;

export const DUEL_AUDIO_EXTENSIONS = new Set([
  "flac", "mp3", "mpeg", "mpga", "m4a", "ogg", "wav", "webm",
]);

export type DuelAudioSegment = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

export type DuelAudioTranscription = {
  duration: number;
  speakers: string[];
  segments: DuelAudioSegment[];
};

export class DuelAudioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuelAudioValidationError";
  }
}

export function duelAudioExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() || "";
}

export function validateDuelAudioMetadata(input: { fileName: unknown; sizeBytes: unknown; mimeType?: unknown }) {
  const fileName = String(input.fileName || "").trim().slice(0, 240);
  const sizeBytes = Number(input.sizeBytes);
  const mimeType = String(input.mimeType || "application/octet-stream").trim().toLowerCase().slice(0, 120);
  const extension = duelAudioExtension(fileName);

  if (!fileName || !DUEL_AUDIO_EXTENSIONS.has(extension)) {
    throw new DuelAudioValidationError("Поддерживаются аудиофайлы FLAC, MP3, MPEG, MPGA, M4A, OGG, WAV и WebM.");
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new DuelAudioValidationError("Выберите непустой аудиофайл.");
  }
  if (sizeBytes > DUEL_AUDIO_MAX_BYTES) {
    throw new DuelAudioValidationError("Аудиофайл должен быть не больше 25 МБ.");
  }
  if (mimeType.startsWith("video/")) {
    throw new DuelAudioValidationError("На этом этапе поддерживается только аудиозапись, без видео.");
  }

  return { fileName, sizeBytes, mimeType, extension };
}

function timestamp(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function formatDiarizedTranscript(
  segments: DuelAudioSegment[],
  speakerNames: Record<string, string> = {},
) {
  return segments
    .map((segment) => {
      const speaker = speakerNames[segment.speaker]?.trim() || `Спикер ${segment.speaker}`;
      return `[${timestamp(segment.start)}–${timestamp(segment.end)}] ${speaker}: ${segment.text.trim()}`;
    })
    .filter(Boolean)
    .join("\n");
}
