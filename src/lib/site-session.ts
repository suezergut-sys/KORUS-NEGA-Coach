import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_COOKIE = "duel_site_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function signingSecret() {
  const value = process.env.SITE_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "";
  if (value.length < 32) throw new Error("SITE_SESSION_SECRET или ADMIN_SESSION_SECRET не настроен.");
  return value;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function verifySitePassword(value: string) {
  const expected = process.env.SITE_PASSWORD || "";
  return expected.length >= 4 && safeEqual(value, expected);
}

export function createSiteSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `site.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySiteSessionToken(token?: string) {
  if (!token) return false;
  const [role, expires, signature] = token.split(".");
  if (role !== "site" || !expires || !signature) return false;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(`${role}.${expires}`));
}

export const siteCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
