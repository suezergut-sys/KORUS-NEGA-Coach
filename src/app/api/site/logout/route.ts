import { NextResponse } from "next/server";
import { SITE_COOKIE } from "@/lib/site-session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SITE_COOKIE, "", { path: "/", expires: new Date(0) });
  return response;
}
