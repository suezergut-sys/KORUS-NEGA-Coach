import { describe, expect, it } from "vitest";
import {
  buildDeterministicPlatformTestReport,
  parsePlatformTestDuration,
  transcriptSimilarity,
} from "../src/lib/platform-test";

describe("platform test evaluation", () => {
  it("accepts only supported durations", () => {
    expect(parsePlatformTestDuration(1)).toBe(1);
    expect(parsePlatformTestDuration("5")).toBe(5);
    expect(parsePlatformTestDuration(15)).toBe(1);
  });

  it("compares generated and recognized speech without depending on punctuation", () => {
    expect(transcriptSimilarity("Давайте согласуем реалистичный план.", "Давайте согласуем реалистичный план")).toBe(1);
    expect(transcriptSimilarity("Нужен план восстановления", "Обсудим совершенно другой вопрос")).toBeLessThan(0.45);
  });

  it("passes a technically healthy exchange", () => {
    const result = buildDeterministicPlatformTestReport({
      durationSeconds: 60,
      turns: [
        { id: "o-1", speaker: "opponent", text: "Что вы предлагаете?", atMs: 10 },
        { id: "h-1", speaker: "human", text: "Давайте согласуем план.", recognizedText: "Давайте согласуем план", atMs: 20 },
      ],
      events: [{ atMs: 30, type: "response_latency", details: { latencyMs: 1_200 } }],
    });
    expect(result.anomalies).toEqual([]);
    expect(result.metrics).toMatchObject({ humanTurns: 1, opponentTurns: 1, averageResponseLatencyMs: 1_200, realtimeErrors: 0 });
  });

  it("reports missing speech, poor transcription, latency and connection failures", () => {
    const result = buildDeterministicPlatformTestReport({
      durationSeconds: 40,
      turns: [
        { id: "o-1", speaker: "opponent", text: "Один и тот же длинный ответ оппонента.", atMs: 10 },
        { id: "o-2", speaker: "opponent", text: "Один и тот же длинный ответ оппонента.", atMs: 20 },
        { id: "h-1", speaker: "human", text: "Предлагаю обсудить сроки", atMs: 30 },
      ],
      events: [
        { atMs: 40, type: "response_latency", details: { latencyMs: 16_000 } },
        { atMs: 50, type: "error", details: { message: "connection lost" } },
      ],
    });
    expect(result.anomalies.map((item) => item.category)).toEqual(expect.arrayContaining(["transcription", "latency", "connection", "dialogue"]));
    expect(result.metrics.maximumResponseLatencyMs).toBe(16_000);
  });
});
