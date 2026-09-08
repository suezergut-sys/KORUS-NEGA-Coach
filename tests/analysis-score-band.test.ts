import { describe, expect, it } from "vitest";
import { analysisScoreBand } from "../src/lib/analysis-score-band";

describe("цветовая шкала итогового балла", () => {
  it.each([
    [0, "red"], [29, "red"], [30, "yellow"], [59, "yellow"], [60, "green"], [100, "green"],
  ] as const)("относит %i баллов к зоне %s", (score, band) => {
    expect(analysisScoreBand(score).id).toBe(band);
  });
});
