import { describe, expect, it } from "vitest";
import { ONBOARDING_STORAGE_KEY, shouldAutoOpenOnboarding } from "../src/lib/onboarding";

describe("onboarding auto-launch", () => {
  it("uses a new versioned completion key", () => {
    expect(ONBOARDING_STORAGE_KEY).toBe("korus-nega-onboarding-v2");
  });

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
