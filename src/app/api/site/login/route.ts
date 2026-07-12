import { NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase-server";
import { createSiteSessionToken, SITE_COOKIE, siteCookieOptions } from "@/lib/site-session";
import { normalizeEmail } from "@/lib/user-auth";

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
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SITE_COOKIE, createSiteSessionToken(data.user), siteCookieOptions);
  return response;
}
