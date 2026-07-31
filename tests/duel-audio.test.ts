import { describe, expect, it } from "vitest";
import {
  DUEL_AUDIO_MAX_BYTES,
  formatDiarizedTranscript,
  validateDuelAudioMetadata,
} from "../src/lib/duel-audio";

describe("duel audio uploads", () => {
  it("accepts a supported audio file up to 25 MB", () => {
    expect(validateDuelAudioMetadata({
      fileName: "meeting.m4a",
      sizeBytes: DUEL_AUDIO_MAX_BYTES,
      mimeType: "audio/mp4",
    })).toMatchObject({ extension: "m4a", sizeBytes: DUEL_AUDIO_MAX_BYTES });
  });

  it("rejects oversized files and video", () => {
    expect(() => validateDuelAudioMetadata({
      fileName: "meeting.mp3",
      sizeBytes: DUEL_AUDIO_MAX_BYTES + 1,
      mimeType: "audio/mpeg",
    })).toThrow("не больше 25 МБ");
    expect(() => validateDuelAudioMetadata({
      fileName: "meeting.webm",
      sizeBytes: 1024,
      mimeType: "video/webm",
    })).toThrow("только аудиозапись");
  });

  it("formats speaker-labelled segments for the existing analyzer", () => {
    expect(formatDiarizedTranscript([
      { speaker: "A", start: 1, end: 8, text: "Добрый день." },
      { speaker: "B", start: 9, end: 70, text: "Обсудим сроки." },
    ], { A: "Анна", B: "Борис" })).toBe(
      "[00:01–00:08] Анна: Добрый день.\n[00:09–01:10] Борис: Обсудим сроки.",
    );
  });
});
