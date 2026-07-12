import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createSiteSessionToken, SITE_COOKIE, siteCookieOptions } from "@/lib/site-session";
import { cleanName, isCorporateEmail, normalizeEmail } from "@/lib/user-auth";

function registrationError(request: Request, code: string) {
  const url = new URL("/register", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const firstName = cleanName(form.get("firstName"));
  const lastName = cleanName(form.get("lastName"));
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") || "");
  if (!firstName || !lastName) return registrationError(request, "name");
  if (!isCorporateEmail(email)) return registrationError(request, "domain");
  if (password.length < 8) return registrationError(request, "password");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { first_name: firstName, last_name: lastName },
  });
  if (error || !data.user) return registrationError(request, /already|registered|exists/i.test(error?.message || "") ? "exists" : "failed");

  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: data.user.id, first_name: firstName, last_name: lastName, email, role: "user",
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return registrationError(request, "failed");
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SITE_COOKIE, createSiteSessionToken(data.user), siteCookieOptions);
  return response;
}
