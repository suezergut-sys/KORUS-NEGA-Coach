import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSiteSessionToken, SITE_COOKIE } from "../src/lib/site-session";
import { proxy } from "../src/proxy";

const previousSiteSecret = process.env.SITE_SESSION_SECRET;

function request(path: string, email = "user@korusconsulting.ru") {
  const headers = new Headers();
  const siteToken = createSiteSessionToken({ id: "user-1", email });
  headers.set("cookie", `${SITE_COOKIE}=${siteToken}`);
  return new NextRequest(`https://example.test${path}`, { headers });
}

describe("admin gateway", () => {
  beforeEach(() => {
    process.env.SITE_SESSION_SECRET = "test-site-session-secret-at-least-32-characters";
  });

  afterEach(() => {
    process.env.SITE_SESSION_SECRET = previousSiteSecret;
  });

  it("redirects an ordinary signed-in user away from administrator pages", () => {
    const response = proxy(request("/admin/cases"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/");
  });

  it("rejects administrator APIs for an ordinary signed-in user", async () => {
    const response = proxy(request("/api/admin/cases/case-1"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Недостаточно прав." });
  });

  it("allows an administrator account without a second password", () => {
    const response = proxy(request("/admin/cases", "MSumin@KorusConsulting.ru"));
    expect(response.status).toBe(200);
  });

  it("lets the media worker reach its own Bearer-protected route", () => {
    const response = proxy(new NextRequest("https://example.test/api/cron/case-media"));
    expect(response.status).toBe(200);
  });

  it("lets the weekly activity worker reach its own Bearer-protected route", () => {
    const response = proxy(new NextRequest("https://example.test/api/cron/weekly-activity"));
    expect(response.status).toBe(200);
  });

  it("lets the weekly fallback worker reach the same Bearer-protected report", () => {
    const response = proxy(new NextRequest("https://example.test/api/cron/weekly-activity-fallback"));
    expect(response.status).toBe(200);
  });
});
