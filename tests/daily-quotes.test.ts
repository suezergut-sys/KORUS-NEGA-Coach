import { describe, expect, it } from "vitest";
import { DAILY_NEGOTIATION_QUOTES, getDailyQuote } from "../src/lib/daily-quotes";

describe("daily negotiation quote calendar", () => {
  it("contains one unique quote for every possible day of a month", () => {
    expect(DAILY_NEGOTIATION_QUOTES).toHaveLength(31);
    expect(new Set(DAILY_NEGOTIATION_QUOTES.map(({ text }) => text)).size).toBe(31);
  });

  it("maps the same day number to the same quote in every month", () => {
    expect(getDailyQuote(new Date(2026, 0, 1))).toEqual(DAILY_NEGOTIATION_QUOTES[0]);
    expect(getDailyQuote(new Date(2026, 7, 31))).toEqual(DAILY_NEGOTIATION_QUOTES[30]);
    expect(getDailyQuote(new Date(2027, 11, 1))).toEqual(DAILY_NEGOTIATION_QUOTES[0]);
  });
});
