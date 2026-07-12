import { describe, expect, it } from "vitest";
import { formatAnalysisTranscript, normalizeAnalysisTurns } from "../src/lib/transcript";

describe("стенограмма длительного поединка", () => {
  it("сохраняет и передаёт в анализ все реплики без обрезания", () => {
    const source = Array.from({ length: 120 }, (_, index) => ({
      id: `turn-${index + 1}`,
      author: index % 2 === 0 ? "Вы" : "Оппонент",
      text: `Реплика ${index + 1}`,
      time: "12:00",
    }));

    const turns = normalizeAnalysisTurns(source);
    const transcript = formatAnalysisTranscript(turns);

    expect(turns).toHaveLength(120);
    expect(turns[0].id).toBe("turn-1");
    expect(turns[119].id).toBe("turn-120");
    expect(transcript).toContain("1. Вы: Реплика 1");
    expect(transcript).toContain("120. Оппонент: Реплика 120");
  });
});
