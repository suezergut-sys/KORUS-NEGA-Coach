export const REALTIME_DIAGNOSTIC_EVENTS = new Set([
  "session_started", "speech_started", "speech_stopped", "response_done",
  "recovery_scheduled", "recovery_triggered", "recovery_skipped", "response_stalled",
  "peer_state", "channel_closed", "channel_error", "audio_track_muted",
  "audio_track_unmuted", "audio_track_ended", "realtime_error",
]);

export function parseRealtimeDiagnostic(value: unknown) {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const event = typeof input.event === "string" ? input.event : "";
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.slice(0, 80) : "";
  const caseId = typeof input.caseId === "string" ? input.caseId.slice(0, 120) : "";
  if (!REALTIME_DIAGNOSTIC_EVENTS.has(event) || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new Error("Некорректное диагностическое событие.");
  }
  const rawDetails = (input.details && typeof input.details === "object" ? input.details : {}) as Record<string, unknown>;
  const details: Record<string, string | number | boolean | null> = {};
  for (const [key, detail] of Object.entries(rawDetails).slice(0, 12)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(key)) continue;
    if (typeof detail === "string") details[key] = detail.slice(0, 240);
    else if (typeof detail === "number" && Number.isFinite(detail)) details[key] = detail;
    else if (typeof detail === "boolean" || detail === null) details[key] = detail;
  }
  return { event, sessionId, caseId, details };
}

export function realtimeResponseStatus(event: Record<string, unknown>) {
  const response = (event.response && typeof event.response === "object" ? event.response : {}) as Record<string, unknown>;
  const statusDetails = (response.status_details && typeof response.status_details === "object" ? response.status_details : {}) as Record<string, unknown>;
  const error = (statusDetails.error && typeof statusDetails.error === "object" ? statusDetails.error : {}) as Record<string, unknown>;
  return {
    responseId: typeof response.id === "string" ? response.id : "",
    status: typeof response.status === "string" ? response.status : "unknown",
    reason: typeof statusDetails.reason === "string" ? statusDetails.reason : typeof statusDetails.type === "string" ? statusDetails.type : "",
    errorCode: typeof error.code === "string" ? error.code : "",
  };
}

export function shouldRecoverRealtimeResponse(input: {
  transcriptVersionAtInterruption: number;
  currentTranscriptVersion: number;
  userSpeaking: boolean;
  newResponseStarted: boolean;
}) {
  return !input.userSpeaking
    && !input.newResponseStarted
    && input.currentTranscriptVersion === input.transcriptVersionAtInterruption;
}
