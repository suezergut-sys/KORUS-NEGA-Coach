export type VoiceEvalRecordSource = "diagnostic" | "realtime" | "client";

export type VoiceEvalRecord = {
  atMs: number;
  source: VoiceEvalRecordSource;
  name: string;
  details: Record<string, string | number | boolean | null>;
};

export type VoiceEvalBridge = {
  createInputStream: () => Promise<MediaStream>;
  record: (record: VoiceEvalRecord) => void;
  playAudioBase64?: (base64: string) => Promise<number>;
  playNoise?: (durationMs: number, amplitude: number) => Promise<void>;
  readRecords?: () => VoiceEvalRecord[];
};

declare global {
  interface Window {
    __VOICE_EVAL__?: VoiceEvalBridge;
  }
}

function scalar(value: unknown): string | number | boolean | null | undefined {
  if (typeof value === "string") return value.slice(0, 4_000);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean" || value === null) return value;
  return undefined;
}

export function recordVoiceEval(
  enabled: boolean,
  source: VoiceEvalRecordSource,
  name: string,
  rawDetails: Record<string, unknown> = {},
) {
  if (!enabled || typeof window === "undefined") return;
  const bridge = window.__VOICE_EVAL__;
  if (!bridge) return;

  const details: VoiceEvalRecord["details"] = {};
  for (const [key, value] of Object.entries(rawDetails)) {
    const safeValue = scalar(value);
    if (safeValue !== undefined) details[key] = safeValue;
  }
  bridge.record({ atMs: performance.now(), source, name, details });
}

export function realtimeEventVoiceEvalDetails(event: Record<string, unknown>) {
  const response = event.response && typeof event.response === "object"
    ? event.response as Record<string, unknown>
    : {};
  const statusDetails = response.status_details && typeof response.status_details === "object"
    ? response.status_details as Record<string, unknown>
    : {};

  return {
    itemId: String(event.item_id || ""),
    responseId: String(event.response_id || response.id || ""),
    transcript: typeof event.transcript === "string" ? event.transcript : "",
    status: typeof response.status === "string" ? response.status : "",
    reason: typeof statusDetails.reason === "string" ? statusDetails.reason : "",
  };
}

export async function acquireVoiceEvalInputStream(enabled: boolean) {
  if (!enabled) {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  }
  const bridge = window.__VOICE_EVAL__;
  if (!bridge) throw new Error("Голосовой eval-драйвер не подключён.");
  const stream = await bridge.createInputStream();
  if (stream.getAudioTracks().length !== 1) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("Голосовой eval-драйвер должен предоставить один аудиотрек.");
  }
  return stream;
}
