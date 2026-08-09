import { NextResponse, type NextRequest } from "next/server";
import { isPlatformAdministrator } from "./lib/admin-access";
import { SITE_COOKIE, readSiteSessionToken } from "./lib/site-session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/api/site/login",
  "/api/site/register",
  "/api/site/logout",
  // The route applies its own CRON_SECRET Bearer authentication.
  "/api/cron/case-media",
  "/api/cron/weekly-activity",
]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (process.env.E2E_TEST_MODE === "1" && pathname.startsWith("/e2e/")) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = readSiteSessionToken(request.cookies.get(SITE_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  if (isAdminRoute && !isPlatformAdministrator(session.email)) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Недостаточно прав." }, { status: 403 });
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
