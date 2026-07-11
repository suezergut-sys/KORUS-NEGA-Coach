import { NextResponse, type NextRequest } from "next/server";
import { SITE_COOKIE, verifySiteSessionToken } from "@/lib/site-session";

const PUBLIC_PATHS = new Set(["/login", "/api/site/login", "/api/site/logout"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const authenticated = verifySiteSessionToken(request.cookies.get(SITE_COOKIE)?.value);
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Требуется пароль сайта." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
