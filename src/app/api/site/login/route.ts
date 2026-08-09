import { NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase-server";
import { createSiteSessionToken, SITE_COOKIE, siteCookieOptions } from "@/lib/site-session";
import { normalizeEmail } from "@/lib/user-auth";
import { recordUserLogin } from "@/lib/user-activity-monitoring";

function safeDestination(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeDestination(form.get("next"));
  const { data, error } = await createSupabaseAuthClient().auth.signInWithPassword({
    email: normalizeEmail(form.get("email")),
    password: String(form.get("password") || ""),
  });
  if (error || !data.user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "credentials");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }
  await recordUserLogin(data.user.id);
  const destination = new URL(next, request.url);
  destination.searchParams.set("welcome", "1");
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set(SITE_COOKIE, createSiteSessionToken(data.user), siteCookieOptions);
  return response;
}
