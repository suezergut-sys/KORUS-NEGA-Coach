import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

describe("platform text readability", () => {
  it("does not define text smaller than 12px", () => {
    const pixelSizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((match) => Number(match[1]));
    expect(Math.min(...pixelSizes)).toBeGreaterThanOrEqual(12);
  });

  it("uses 13px for representative primary content", () => {
    expect(css).toMatch(/\.case-library-card-copy > p[^}]+font-size:\s*13px/);
    expect(css).toMatch(/\.case-library-context p[^}]+font-size:\s*13px/);
    expect(css).toMatch(/\.case-library-role dd[^}]+font-size:\s*13px/);
    expect(css).toMatch(/\.message-bubble p[^}]+font-size:\s*13px/);
    expect(css).toMatch(/\.duel-history-table td[^}]+font-size:\s*13px/);
  });
});
