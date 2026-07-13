import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "./lib/admin-session";
import { SITE_COOKIE, verifySiteSessionToken } from "./lib/site-session";

const PUBLIC_PATHS = new Set(["/login", "/register", "/api/site/login", "/api/site/register", "/api/site/logout"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const authenticated = verifySiteSessionToken(request.cookies.get(SITE_COOKIE)?.value);
  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAdminLogin = pathname === "/admin/login" || pathname === "/api/admin/login" || pathname === "/api/admin/logout";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  if (isAdminRoute && !isAdminLogin && !verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Требуется пароль администратора." }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
