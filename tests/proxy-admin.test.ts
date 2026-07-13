import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSessionToken, ADMIN_COOKIE } from "../src/lib/admin-session";
import { createSiteSessionToken, SITE_COOKIE } from "../src/lib/site-session";
import { proxy } from "../src/proxy";

const previousAdminSecret = process.env.ADMIN_SESSION_SECRET;
const previousSiteSecret = process.env.SITE_SESSION_SECRET;

function request(path: string, admin = false) {
  const headers = new Headers();
  const siteToken = createSiteSessionToken({ id: "user-1", email: "user@korusconsulting.ru" });
  const cookies = [`${SITE_COOKIE}=${siteToken}`];
  if (admin) cookies.push(`${ADMIN_COOKIE}=${createAdminSessionToken()}`);
  headers.set("cookie", cookies.join("; "));
  return new NextRequest(`https://example.test${path}`, { headers });
}

describe("admin gateway", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-characters";
    process.env.SITE_SESSION_SECRET = "test-site-session-secret-at-least-32-characters";
  });

  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = previousAdminSecret;
    process.env.SITE_SESSION_SECRET = previousSiteSecret;
  });

  it("redirects an ordinary signed-in user to the shared admin password page", () => {
    const response = proxy(request("/admin/cases"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/admin/login");
  });

  it("rejects admin APIs without an admin password session", async () => {
    const response = proxy(request("/api/admin/cases/case-1"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Требуется пароль администратора." });
  });

  it("allows access after the shared admin password session is issued", () => {
    const response = proxy(request("/admin/cases", true));
    expect(response.status).toBe(200);
  });
});
