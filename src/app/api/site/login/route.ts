import { NextResponse } from "next/server";
import { createSiteSessionToken, SITE_COOKIE, siteCookieOptions, verifySitePassword } from "@/lib/site-session";

function safeDestination(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeDestination(form.get("next"));
  if (!verifySitePassword(String(form.get("password") || ""))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SITE_COOKIE, createSiteSessionToken(), siteCookieOptions);
  return response;
}
