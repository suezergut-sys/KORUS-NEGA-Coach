import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY,
  clampOnboardingStep,
  getOnboardingStorage,
  readOnboardingCompleted,
  shouldAutoOpenOnboarding,
  writeOnboardingCompleted,
} from "../src/lib/onboarding";

describe("onboarding content", () => {
  it("uses the v3 completion key and the approved seven-screen order", () => {
    expect(ONBOARDING_STORAGE_KEY).toBe("korus-nega-onboarding-v3");
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "capabilities",
      "negotiations",
      "progress",
      "cases",
      "analysis",
      "ready",
    ]);
  });

  it("does not depend on interface screenshots", () => {
    expect(JSON.stringify(ONBOARDING_STEPS)).not.toContain("/onboarding/");
    expect(JSON.stringify(ONBOARDING_STEPS)).not.toContain(".png");
  });

  it("uses informal address and includes mobile access without VPN", () => {
    const copy = JSON.stringify(ONBOARDING_STEPS);
    expect(copy).not.toMatch(/(^|[\s«„"])вы([\s»“".,!?:;]|$)/iu);
    expect(copy).toContain("без VPN");
    expect(copy).toContain("телефона");
    expect(copy).toContain("дополнительная установка не требуется");
  });
});

describe("onboarding completion storage", () => {
  it("resolves localStorage without leaking a browser security error", () => {
    const blockedWindow = Object.defineProperty({}, "localStorage", {
      get: () => { throw new Error("blocked"); },
    });
    expect(getOnboardingStorage(blockedWindow)).toBeNull();
  });

  it("reads and writes the completed mark", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(readOnboardingCompleted(storage)).toBe(false);
    expect(writeOnboardingCompleted(storage)).toBe(true);
    expect(readOnboardingCompleted(storage)).toBe(true);
  });

  it("does not throw when browser storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readOnboardingCompleted(storage)).toBe(false);
    expect(writeOnboardingCompleted(storage)).toBe(false);
  });
});

describe("onboarding step navigation", () => {
  it("keeps keyboard navigation inside the seven-screen range", () => {
    expect(clampOnboardingStep(-1, ONBOARDING_STEPS.length)).toBe(0);
    expect(clampOnboardingStep(3, ONBOARDING_STEPS.length)).toBe(3);
    expect(clampOnboardingStep(7, ONBOARDING_STEPS.length)).toBe(6);
  });
});

describe("onboarding auto-launch", () => {
  it("opens once for an existing authenticated user without the current completion mark", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/", requested: false, completed: false })).toBe(true);
    expect(shouldAutoOpenOnboarding({ pathname: "/account", requested: false, completed: false })).toBe(true);
  });

  it("stays closed after the current onboarding version is completed", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/", requested: false, completed: true })).toBe(false);
  });

  it("does not cover public or admin entry pages automatically", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/login", requested: false, completed: false })).toBe(false);
    expect(shouldAutoOpenOnboarding({ pathname: "/register", requested: false, completed: false })).toBe(false);
    expect(shouldAutoOpenOnboarding({ pathname: "/admin/login", requested: false, completed: false })).toBe(false);
  });

  it("honors an explicit first-run request after registration", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/", requested: true, completed: true })).toBe(true);
  });
});
