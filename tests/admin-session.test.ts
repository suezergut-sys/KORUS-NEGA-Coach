import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdminSessionToken, verifyAdminPassword, verifyAdminSessionToken } from "../src/lib/admin-session";

const previousSecret = process.env.ADMIN_SESSION_SECRET;
const previousPassword = process.env.ADMIN_PASSWORD;

describe("admin session", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-characters";
    process.env.ADMIN_PASSWORD = "strong-password";
  });

  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = previousSecret;
    process.env.ADMIN_PASSWORD = previousPassword;
  });

  it("requires the configured shared admin password", () => {
    expect(verifyAdminPassword("strong-password")).toBe(true);
    expect(verifyAdminPassword("wrong-password")).toBe(false);
  });

  it("accepts only signed, unmodified admin sessions", () => {
    const token = createAdminSessionToken();
    expect(verifyAdminSessionToken(token)).toBe(true);
    expect(verifyAdminSessionToken(`${token}x`)).toBe(false);
    expect(verifyAdminSessionToken()).toBe(false);
  });
});
