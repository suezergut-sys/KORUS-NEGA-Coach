import { describe, expect, it } from "vitest";
import { countUserTurns, formatAnalysisTranscript, hasEnoughUserTurnsForAnalysis, normalizeAnalysisTurns } from "../src/lib/transcript";

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

describe("минимум данных для анализа", () => {
  it("не допускает анализ при одной или двух репликах участника", () => {
    const turns = [
      { id: "1", author: "Вы", text: "Проверка микрофона", time: "12:00" },
      { id: "2", author: "Оппонент", text: "Я вас слышу", time: "12:01" },
      { id: "3", author: "Вы", text: "Вторая реплика", time: "12:02" },
    ];
    expect(countUserTurns(turns)).toBe(2);
    expect(hasEnoughUserTurnsForAnalysis(turns)).toBe(false);
  });

  it("допускает анализ начиная с трёх реплик участника", () => {
    const turns = ["Первая", "Вторая", "Третья"].map((text, index) => ({ author: "Вы", text, id: String(index), time: "12:00" }));
    expect(hasEnoughUserTurnsForAnalysis(turns)).toBe(true);
  });
});
