import { describe, expect, it } from "vitest";
import { buildRealtimeSessionConfig } from "../src/lib/realtime-session";

describe("realtime session config", () => {
  it("uses GPT Realtime 2.1 for the voice opponent", () => {
    const session = buildRealtimeSessionConfig({
      instructions: "Веди переговоры по-русски.",
      negotiationStyle: "collaborative",
      voice: "marin",
    });

    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.instructions).toContain("абсолютно каждую реплику только на русском языке");
    expect(session.instructions).toContain("Веди переговоры по-русски.");
  });

  it("prioritizes a verbatim Russian transcript over streaming latency", () => {
    const session = buildRealtimeSessionConfig({
      instructions: "Веди переговоры по-русски.",
      negotiationStyle: "collaborative",
      voice: "marin",
    });

    expect(session.audio.input.transcription).toEqual({
      model: "gpt-live-transcribe",
      languages: ["ru"],
      prompt: expect.stringContaining("Сохраняй все произнесённые слова"),
      delay: "xhigh",
    });
    expect(session.audio.input.transcription.prompt).toContain("Не перефразируй");
    expect(session.audio.input.transcription.prompt).toContain("исходный порядок слов");
    expect(session.audio.input.noise_reduction).toEqual({ type: "far_field" });
  });

  it("preserves negotiation-specific voice activity detection", () => {
    const collaborative = buildRealtimeSessionConfig({
      instructions: "test",
      negotiationStyle: "collaborative",
      voice: "marin",
    });
    const hard = buildRealtimeSessionConfig({
      instructions: "test",
      negotiationStyle: "hard",
      voice: "cedar",
    });

    expect(collaborative.audio.input.turn_detection.eagerness).toBe("low");
    expect(hard.audio.input.turn_detection.eagerness).toBe("high");
    expect(collaborative.audio.input.turn_detection.create_response).toBe(false);
    expect(hard.audio.input.turn_detection.create_response).toBe(false);
    expect(hard.audio.input.turn_detection.interrupt_response).toBe(false);
    expect(hard.audio.output.voice).toBe("cedar");
  });
});
