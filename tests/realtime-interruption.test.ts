import { describe, expect, it } from "vitest";
import {
  isMeaningfulUserSpeechTranscript,
  shouldConfirmRealtimeInterruption,
  type RealtimeInterruptionCandidate,
} from "../src/lib/realtime-interruption";

const candidate: RealtimeInterruptionCandidate = {
  itemId: "user-1",
  responseId: "resp-1",
  transcriptVersion: 2,
  startedAt: 1000,
  durationMs: 420,
  wasAudible: true,
};

describe("realtime interruption confirmation", () => {
  it.each(["", "...", "[Шум]", "(фоновый шум)", "тишина", "[неразборчиво]"])(
    "rejects a non-speech transcript: %j",
    (transcript) => {
      expect(isMeaningfulUserSpeechTranscript(transcript)).toBe(false);
      expect(shouldConfirmRealtimeInterruption(candidate, transcript)).toBe(false);
    },
  );

  it.each(["Да", "Стоп, это условие мне не подходит", "Предлагаю 15%"])(
    "confirms meaningful user speech: %j",
    (transcript) => {
      expect(isMeaningfulUserSpeechTranscript(transcript)).toBe(true);
      expect(shouldConfirmRealtimeInterruption(candidate, transcript)).toBe(true);
    },
  );

  it("requires an interruption candidate even for meaningful speech", () => {
    expect(shouldConfirmRealtimeInterruption(null, "Стоп")).toBe(false);
  });

  it("does not count speech before playback starts as an interruption", () => {
    expect(shouldConfirmRealtimeInterruption({ ...candidate, wasAudible: false }, "Стоп")).toBe(false);
  });
});
