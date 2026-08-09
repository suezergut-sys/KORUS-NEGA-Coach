import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldOpenWelcomeBack } from "../src/lib/welcome-back";

describe("welcome-back launch", () => {
  it("opens after login only when onboarding is completed", () => {
    expect(shouldOpenWelcomeBack({ pathname: "/", requested: true, onboardingCompleted: true })).toBe(true);
    expect(shouldOpenWelcomeBack({ pathname: "/", requested: true, onboardingCompleted: false })).toBe(false);
    expect(shouldOpenWelcomeBack({ pathname: "/", requested: false, onboardingCompleted: true })).toBe(false);
  });

  it("stays hidden on public and administrator screens", () => {
    expect(shouldOpenWelcomeBack({ pathname: "/login", requested: true, onboardingCompleted: true })).toBe(false);
    expect(shouldOpenWelcomeBack({ pathname: "/register", requested: true, onboardingCompleted: true })).toBe(false);
    expect(shouldOpenWelcomeBack({ pathname: "/admin/users", requested: true, onboardingCompleted: true })).toBe(false);
  });

  it("renders the requested metrics and records successful logins", () => {
    const component = readFileSync("src/components/WelcomeBackModal.tsx", "utf8");
    const loginRoute = readFileSync("src/app/api/site/login/route.ts", "utf8");
    const migration = readFileSync("supabase/migrations/20260809120000_user_login_activity.sql", "utf8");

    expect(component).toContain("Привет, {stats.firstName}!");
    expect(component).toContain("Входов на платформу");
    expect(component).toContain("Отыгранных кейсов");
    expect(component).toContain("Процент побед");
    expect(component).toContain("Средний балл");
    expect(component).toContain("Цитата дня");
    expect(component).toContain("getDailyQuote()");
    expect(component).toContain("Тренировать");
    expect(component).toContain("База кейсов");
    expect(component).toContain("Личный кабинет");
    expect(loginRoute).toContain("await recordUserLogin(data.user.id)");
    expect(migration).toContain("'user_logged_in'");
  });
});
