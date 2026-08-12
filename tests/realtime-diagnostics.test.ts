import { describe, expect, it } from "vitest";
import { parseRealtimeDiagnostic, realtimeResponseStatus, shouldMonitorRealtimeResponseStall, shouldRecoverRealtimeResponse } from "../src/lib/realtime-diagnostics";

describe("realtime diagnostics", () => {
  it("accepts bounded lifecycle details without transcript content", () => {
    const result = parseRealtimeDiagnostic({
      event: "response_done",
      sessionId: "11111111-1111-4111-8111-111111111111",
      caseId: "case-1",
      details: { status: "cancelled", durationMs: 1234, "bad key": "ignored" },
    });
    expect(result.details).toEqual({ status: "cancelled", durationMs: 1234 });
  });

  it("rejects unknown events", () => {
    expect(() => parseRealtimeDiagnostic({ event: "audio.delta", sessionId: "11111111-1111-4111-8111-111111111111" })).toThrow();
  });

  it("accepts response pause diagnostics without audio or transcript content", () => {
    expect(parseRealtimeDiagnostic({
      event: "response_pause_recorded",
      sessionId: "11111111-1111-4111-8111-111111111111",
      details: { pauseMs: 850 },
    }).details).toEqual({ pauseMs: 850 });
  });

  it.each(["pause_started", "pause_resumed", "output_audio_buffer_started", "turn_gate_waiting", "turn_gate_released", "turn_gate_clarification", "emotion_shift", "interruption_confirmed", "noise_ignored", "barge_in_sent", "barge_in_stop_confirmed"])(
    "accepts the %s lifecycle event",
    (event) => expect(parseRealtimeDiagnostic({
      event,
      sessionId: "11111111-1111-4111-8111-111111111111",
      details: { fragmentCount: 1 },
    }).event).toBe(event),
  );

  it("extracts incomplete response outcome", () => {
    expect(realtimeResponseStatus({ response: { id: "resp-1", status: "incomplete", status_details: { reason: "turn_detected" } } })).toEqual({
      responseId: "resp-1", status: "incomplete", reason: "turn_detected", errorCode: "",
    });
  });

  it("recovers only when an interruption produced no real user turn", () => {
    expect(shouldRecoverRealtimeResponse({ transcriptVersionAtInterruption: 2, currentTranscriptVersion: 2, userSpeaking: false, newResponseStarted: false })).toBe(true);
    expect(shouldRecoverRealtimeResponse({ transcriptVersionAtInterruption: 2, currentTranscriptVersion: 3, userSpeaking: false, newResponseStarted: false })).toBe(false);
    expect(shouldRecoverRealtimeResponse({ transcriptVersionAtInterruption: 2, currentTranscriptVersion: 2, userSpeaking: true, newResponseStarted: false })).toBe(false);
    expect(shouldRecoverRealtimeResponse({ transcriptVersionAtInterruption: 2, currentTranscriptVersion: 2, userSpeaking: false, newResponseStarted: true })).toBe(false);
  });

  it("does not start stall recovery while completed audio is only draining", () => {
    expect(shouldMonitorRealtimeResponseStall({
      responseInProgress: false,
      opponentSpeaking: true,
      userSpeaking: false,
      recoveryPending: false,
    })).toBe(false);
    expect(shouldMonitorRealtimeResponseStall({
      responseInProgress: true,
      opponentSpeaking: true,
      userSpeaking: false,
      recoveryPending: false,
    })).toBe(true);
  });
});
