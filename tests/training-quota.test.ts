import { describe, expect, it } from "vitest";
import {
  formatTrainingQuota,
  isTrainingQuotaExhausted,
  mapDailyTrainingQuota,
  normalizeTrainingTier,
  PREMIUM_DAILY_TRAINING_LIMIT,
  STANDARD_DAILY_TRAINING_LIMIT,
  TRAINING_LIMIT_CONTACT_URL,
} from "../src/lib/training-quota";

describe("daily training quota", () => {
  it("uses the requested standard and premium limits", () => {
    expect(STANDARD_DAILY_TRAINING_LIMIT).toBe(3);
    expect(PREMIUM_DAILY_TRAINING_LIMIT).toBe(20);
    expect(normalizeTrainingTier("premium")).toBe("premium");
    expect(normalizeTrainingTier("unexpected")).toBe("standard");
  });

  it("maps remaining attempts and detects exhaustion", () => {
    const quota = mapDailyTrainingQuota({
      training_tier: "premium",
      daily_limit: 20,
      used_today: 6,
      remaining_today: 14,
    });
    expect(quota).toEqual({ tier: "premium", limit: 20, used: 6, remaining: 14 });
    expect(formatTrainingQuota(quota)).toBe("14/20");
    expect(isTrainingQuotaExhausted(quota)).toBe(false);
    expect(isTrainingQuotaExhausted({ ...quota, remaining: 0 })).toBe(true);
  });

  it("keeps administrators unlimited", () => {
    const quota = mapDailyTrainingQuota({ training_tier: "standard", used_today: 25 }, true);
    expect(quota).toEqual({ tier: "standard", limit: null, used: 25, remaining: null });
    expect(formatTrainingQuota(quota)).toBe("∞");
    expect(isTrainingQuotaExhausted(quota)).toBe(false);
    expect(mapDailyTrainingQuota({ training_tier: "standard", daily_limit: null, used_today: 26, remaining_today: null }).limit).toBeNull();
  });

  it("links the premium contact to Maxim Sumin", () => {
    expect(TRAINING_LIMIT_CONTACT_URL).toBe("https://t.me/SueZergut");
  });
});
