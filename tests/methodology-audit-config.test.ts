import { describe, expect, it } from "vitest";
import { METHODOLOGY_AUDIT, METHODOLOGY_KIND_DEFINITIONS } from "../scripts/methodology-audit-config.mjs";

describe("methodology atom classification audit", () => {
  it("covers exactly the five documented atom kinds", () => {
    expect(Object.keys(METHODOLOGY_KIND_DEFINITIONS)).toEqual([
      "principle", "case_rule", "stratagem", "example", "evaluation_criterion",
    ]);
  });

  it("keeps the expected atom totals for all three sources", () => {
    expect(Object.keys(METHODOLOGY_AUDIT)).toEqual(["SRC-001", "SRC-002", "SRC-003"]);
    for (const config of Object.values(METHODOLOGY_AUDIT)) {
      expect(Object.values(config.expectedKinds).reduce((sum, count) => sum + count, 0)).toBe(config.expectedAtoms);
      expect(new Set(Object.keys(config.corrections)).size).toBe(Object.keys(config.corrections).length);
    }
  });
});
