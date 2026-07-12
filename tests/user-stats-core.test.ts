import { describe, expect, it } from "vitest";
import { averageLatestScores } from "../src/lib/user-stats-core";

describe("средний балл рейтинга", () => {
  it("считает среднее только по десяти последним поединкам", () => {
    expect(averageLatestScores([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0])).toBe(55);
  });

  it("не учитывает поединки без завершённой оценки", () => {
    expect(averageLatestScores([80, null, 70])).toBe(75);
    expect(averageLatestScores([null])).toBeNull();
  });
});
