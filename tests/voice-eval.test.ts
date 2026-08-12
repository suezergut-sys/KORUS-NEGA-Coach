import { describe, expect, it } from "vitest";
import {
  countVoiceEvalRecords,
  evaluateVoiceEvalTrace,
  findUnsupportedCriticalFacts,
} from "@/lib/voice-eval-evaluation";
import type { VoiceEvalRecord } from "@/lib/voice-eval";

const records: VoiceEvalRecord[] = [
  { atMs: 100, source: "diagnostic", name: "barge_in_sent", details: {} },
  { atMs: 280, source: "diagnostic", name: "barge_in_stop_confirmed", details: { latencyMs: 180 } },
  { atMs: 600, source: "diagnostic", name: "interruption_confirmed", details: {} },
  { atMs: 900, source: "realtime", name: "response.done", details: { status: "completed" } },
];

describe("voice eval evaluation", () => {
  it("проверяет количество событий и задержку остановки голоса", () => {
    const result = evaluateVoiceEvalTrace(records, {
      rules: [
        { source: "diagnostic", name: "interruption_confirmed", minCount: 1, maxCount: 1 },
        { source: "diagnostic", name: "noise_ignored", maxCount: 0 },
      ],
      maxBargeInStopLatencyMs: 500,
    });

    expect(result).toEqual({ passed: true, failures: [] });
    expect(countVoiceEvalRecords(records, "realtime", "response.done")).toBe(1);
  });

  it("возвращает объяснения всех нарушенных технических критериев", () => {
    const result = evaluateVoiceEvalTrace(records, {
      rules: [
        { source: "diagnostic", name: "interruption_confirmed", minCount: 2 },
        { source: "realtime", name: "response.done", maxCount: 0 },
      ],
      maxBargeInStopLatencyMs: 100,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(3);
  });

  it("находит числа и сроки, которых нет в разрешённом контексте", () => {
    const evidence = "Срок восстановления — не более 10 рабочих дней.";
    const output = "Нам понадобится 10 дней и бюджет 500000 рублей.";

    expect(findUnsupportedCriticalFacts(output, evidence)).toEqual(["500000 рублей"]);
  });

  it("считает весь новый диапазон одним неподтверждённым фактом", () => {
    expect(findUnsupportedCriticalFacts("Нужно 5–7 дней.", "В кейсе указан срок 10 дней.")).toEqual(["5–7 дней"]);
  });
});
