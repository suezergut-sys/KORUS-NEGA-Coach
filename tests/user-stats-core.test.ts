import { describe, expect, it } from "vitest";
import { averageLatestScores, calculateSkillProgress } from "../src/lib/user-stats-core";

describe("средний балл рейтинга", () => {
  it("считает среднее только по десяти последним поединкам", () => {
    expect(averageLatestScores([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0])).toBe(55);
  });

  it("не учитывает поединки без завершённой оценки", () => {
    expect(averageLatestScores([80, null, 70])).toBe(75);
    expect(averageLatestScores([null])).toBeNull();
  });
});

describe("карта навыков", () => {
  it("игнорирует старые отчёты без идентификаторов фиксированной рубрики", () => {
    expect(calculateSkillProgress([
      { scoreBreakdown: [{ score: 13 }, { id: "legacy", score: 12 }] },
    ])).toEqual([]);
  });

  it("считает динамику только по пяти серверным критериям", () => {
    expect(calculateSkillProgress([
      { scoreBreakdown: [{ id: "goal", score: 14 }] },
      { scoreBreakdown: [{ id: "goal", score: 10 }] },
    ])).toEqual([{
      id: "goal",
      label: "Продвижение к цели",
      average: 12,
      latest: 14,
      delta: 4,
      attempts: 2,
    }]);
  });
});
