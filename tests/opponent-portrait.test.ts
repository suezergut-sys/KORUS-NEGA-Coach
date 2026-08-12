import { describe, expect, it } from "vitest";
import { OPPONENT_PORTRAITS, opponentPortraitForRole } from "../src/lib/opponent-portrait";

describe("opponentPortraitForRole", () => {
  it("keeps the same portrait for the same character", () => {
    const role = { name: "Анна Воронцова", voiceGender: "female" as const };

    expect(opponentPortraitForRole(role)).toBe(opponentPortraitForRole({ ...role }));
  });

  it("selects portraits only from the character gender collection", () => {
    expect(opponentPortraitForRole({ name: "Анна Воронцова", voiceGender: "female" }))
      .toMatch(/^\/opponents\/female-\d{2}\.webp$/);
    expect(opponentPortraitForRole({ name: "Алексей Воронцов", voiceGender: "male" }))
      .toMatch(/^\/opponents\/male-\d{2}\.webp$/);
  });

  it("publishes six distinct portraits for each gender", () => {
    expect(new Set(OPPONENT_PORTRAITS.female).size).toBe(6);
    expect(new Set(OPPONENT_PORTRAITS.male).size).toBe(6);
  });
});
