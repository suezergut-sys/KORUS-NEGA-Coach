import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../src/lib/async-pool";

describe("mapWithConcurrency", () => {
  it("preserves order and never exceeds the worker limit", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });

  it("rejects an invalid limit", async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(/positive integer/);
  });
});
