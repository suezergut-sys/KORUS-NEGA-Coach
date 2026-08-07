import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_ACTIVITY_LABELS, ADMIN_LOG_PAGE_SIZE, formatAdminDate, parseAdminLogPage } from "../src/lib/admin-activity";

describe("admin users and activity logs", () => {
  it("uses 50 actions per page and validates the requested page", () => {
    expect(ADMIN_LOG_PAGE_SIZE).toBe(50);
    expect(parseAdminLogPage(undefined)).toBe(1);
    expect(parseAdminLogPage("3")).toBe(3);
    expect(parseAdminLogPage("0")).toBe(1);
    expect(parseAdminLogPage("wrong")).toBe(1);
  });

  it("has a readable label for every requested action", () => {
    expect(ADMIN_ACTIVITY_LABELS).toEqual({
      user_registered: "Регистрация на платформе",
      case_created: "Создание кейса",
      case_uploaded: "Загрузка кейса",
      duel_analyzed: "Анализ поединка",
      case_played: "Проведение поединка",
      feedback_submitted: "Оставил(а) обратную связь",
    });
  });

  it("formats activity dates in Moscow time", () => {
    expect(formatAdminDate("2026-08-07T09:05:00.000Z")).toContain("12:05");
    expect(formatAdminDate(null)).toBe("—");
  });

  it("records external duel analysis only after a successful model result", () => {
    const route = readFileSync("src/app/api/duel-analysis/route.ts", "utf8");
    expect(route.indexOf("await recordUserActivity({")).toBeGreaterThan(route.indexOf("parseStructuredOutput<DuelFileAnalysis>"));
    expect(route).toContain('type: "duel_analyzed"');
  });

  it("keeps the users RPC private and sorts registrations newest first", () => {
    const migration = readFileSync("supabase/migrations/20260807160000_admin_users_and_activity_logs.sql", "utf8");
    expect(migration).toContain("revoke all on function public.admin_user_overview() from public, anon, authenticated");
    expect(migration).toMatch(/order by profiles\.created_at desc/i);
    expect(migration).toContain("'duel_analyzed'");
  });
});
