import { describe, expect, it } from "vitest";
import { readSpeechAnalytics, summarizeSpeechAnalytics } from "../src/lib/speech-analytics";
import type { TranscriptTurn } from "../src/lib/transcript";

const turns: TranscriptTurn[] = [
  { id: "1", author: "Вы", text: "Ну, как бы, почему вы не согласовали срок?", time: "10:00" },
  { id: "2", author: "Оппонент", text: "У нас не было ресурсов.", time: "10:01" },
  { id: "3", author: "Вы", text: "Что необходимо, чтобы завершить работу?", time: "10:02" },
];

describe("speech analytics", () => {
  it("is generated only for duplex mode", () => {
    expect(summarizeSpeechAnalytics({
      inputMode: "push_to_talk",
      turns,
      userSpeakingDurationsMs: [4_000],
    })).toBeNull();
  });

  it("calculates tempo, pauses, talk share, questions and fillers", () => {
    const result = summarizeSpeechAnalytics({
      inputMode: "duplex",
      turns,
      userSpeakingDurationsMs: [4_000, 6_000],
      opponentSpeakingDurationsMs: [10_000],
      userResponseTimesMs: [1_000, 4_000],
      interruptionCount: 1,
    });
    expect(result).toMatchObject({
      available: true,
      inputMode: "duplex",
      talkSharePercent: 50,
      pauseCount: 2,
      longPauseCount: 1,
      responseTimeP50Ms: 1_000,
      responseTimeP95Ms: 4_000,
      questionCount: 2,
      fillerCount: 2,
      fillerWordCount: 3,
      fillerPercent: 23.1,
      timingVersion: 2,
      timingAvailable: true,
      interruptionCount: 1,
    });
    expect(result?.tempoWpm).toBeGreaterThan(0);
    expect(result?.pressureReaction.level).toBe("hesitant");
  });

  it("bounds malformed client timings", () => {
    const result = summarizeSpeechAnalytics({
      inputMode: "duplex",
      turns,
      userSpeakingDurationsMs: [-1, "5000", Number.NaN],
      opponentSpeakingDurationsMs: [999_999],
      userResponseTimesMs: ["2000", null],
      interruptionCount: -5,
    });
    expect(result?.userSpeakingMs).toBe(5_000);
    expect(result?.opponentSpeakingMs).toBe(120_000);
    expect(result?.interruptionCount).toBe(0);
  });

  it("marks timing metrics unavailable when the opponent audio was not measured", () => {
    const result = summarizeSpeechAnalytics({
      inputMode: "duplex",
      turns,
      userSpeakingDurationsMs: [10_000],
      opponentSpeakingDurationsMs: [],
      userResponseTimesMs: [],
      interruptionCount: 0,
    });

    expect(result).toMatchObject({
      timingAvailable: false,
      talkSharePercent: 100,
      pressureReaction: {
        level: "unavailable",
        label: "Недостаточно данных",
      },
    });
  });

  it("marks reports from the RTP-level timing implementation as unavailable", () => {
    const result = readSpeechAnalytics({
      available: true,
      inputMode: "duplex",
      words: 283,
      userTurns: 8,
      userSpeakingMs: 134_231,
      opponentSpeakingMs: 37_381,
      tempoWpm: 126,
      timingAvailable: true,
      talkSharePercent: 78,
      pauseCount: 6,
      longPauseCount: 5,
      averagePauseMs: 20_274,
      responseTimeP50Ms: 23_107,
      responseTimeP95Ms: 28_660,
      questionCount: 2,
      fillerCount: 5,
      fillerRatePer100Words: 1.8,
      fillers: [{ phrase: "ну", count: 3 }, { phrase: "значит", count: 2 }],
      interruptionCount: 0,
      pressureReaction: { level: "steady", label: "Сохраняет рабочий темп", explanation: "" },
    });

    expect(result).toMatchObject({
      timingVersion: 1,
      timingAvailable: false,
      fillerWordCount: 5,
      fillerPercent: 1.8,
      pressureReaction: { level: "unavailable" },
    });
  });
});
