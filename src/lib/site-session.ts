import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_COOKIE = "duel_user_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SiteSession = { userId: string; email: string; expiresAt: number };

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

export function createSiteSessionToken(user: { id: string; email?: string | null }) {
  const session: SiteSession = { userId: user.id, email: user.email || "", expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSiteSessionToken(token?: string): SiteSession | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SiteSession;
    if (!session.userId || !session.email || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch { return null; }
}

export function verifySiteSessionToken(token?: string) { return Boolean(readSiteSessionToken(token)); }

export const siteCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
