import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPlatformAdministrator, PLATFORM_ADMINISTRATORS, platformRoleLabel } from "../src/lib/admin-access";

describe("platform administrator access", () => {
  it("uses the explicit corporate account allowlist", () => {
    expect(PLATFORM_ADMINISTRATORS).toEqual([
      { firstName: "Максим", lastName: "Сумин", email: "msumin@korusconsulting.ru" },
      { firstName: "Алина", lastName: "Родченкова", email: "arodchenkova@korusconsulting.ru" },
    ]);
    expect(isPlatformAdministrator(" MSumin@KorusConsulting.ru ")).toBe(true);
    expect(isPlatformAdministrator(" ARodchenkova@KorusConsulting.ru ")).toBe(true);
    expect(isPlatformAdministrator("user@korusconsulting.ru")).toBe(false);
  });

  it("provides role labels for the administrator user table", () => {
    expect(platformRoleLabel("msumin@korusconsulting.ru")).toBe("Администратор");
    expect(platformRoleLabel("arodchenkova@korusconsulting.ru")).toBe("Администратор");
    expect(platformRoleLabel("user@korusconsulting.ru")).toBe("Пользователь");

    const page = readFileSync("src/app/admin/(protected)/users/page.tsx", "utf8");
    expect(page).toContain("<th>Роль</th>");
    expect(page).toContain("platformRoleLabel(user.email)");
  });

  it("does not expose a second administrator password form", () => {
    const page = readFileSync("src/app/admin/login/page.tsx", "utf8");
    expect(page).toContain('redirect("/admin")');
    expect(page).not.toContain("password");
  });

  it("loads navigation visibility from the signed user session", () => {
    const sidebar = readFileSync("src/components/UserSidebar.tsx", "utf8");
    const accessRoute = readFileSync("src/app/api/site/access/route.ts", "utf8");
    expect(sidebar).toContain('fetch("/api/site/access"');
    expect(accessRoute).toContain("isPlatformAdministrator(session?.email)");
  });
});
