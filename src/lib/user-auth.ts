import "server-only";
import { cookies } from "next/headers";
import { SITE_COOKIE, readSiteSessionToken } from "@/lib/site-session";

const CORPORATE_DOMAINS = ["korusconsulting.ru", "mons.ru"];

export function normalizeEmail(value: unknown) { return String(value || "").trim().toLowerCase(); }
export function isCorporateEmail(email: string) { return CORPORATE_DOMAINS.includes(normalizeEmail(email).split("@")[1] || ""); }
export function cleanName(value: unknown) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80); }
export async function getCurrentUserSession() { return readSiteSessionToken((await cookies()).get(SITE_COOKIE)?.value); }
