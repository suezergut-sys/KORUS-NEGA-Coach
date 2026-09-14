import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatAdminAverageScore } from "../src/lib/admin-one-c-dashboard";

describe("admin 1C dashboard", () => {
  const migration = readFileSync("supabase/migrations/20260914170000_admin_one_c_dashboard.sql", "utf8");
  const page = readFileSync("src/app/admin/(protected)/one-c-dashboard/page.tsx", "utf8");
  const layout = readFileSync("src/app/admin/(protected)/layout.tsx", "utf8");

  it("shows a stable one-decimal score and an empty-state dash", () => {
    expect(formatAdminAverageScore(83)).toBe("83,0");
    expect(formatAdminAverageScore("74.6")).toBe("74,6");
    expect(formatAdminAverageScore(null)).toBe("—");
    expect(formatAdminAverageScore("wrong")).toBe("—");
  });

  it("aggregates only 1C users and completed sessions from their registration date", () => {
    expect(migration).toContain("where departments.code = '1c'");
    expect(migration).toContain("events.event_type = 'user_logged_in'");
    expect(migration).toContain("sessions.status in ('completed', 'analysis_pending', 'analysis_processing', 'analyzed', 'analysis_failed')");
    expect(migration).toContain("sessions.ended_at >= users.registered_at");
    expect(migration).toContain("coalesce(evaluations.initial_overall_score, evaluations.overall_score)");
    expect(migration).toMatch(/order by lower\(users\.last_name\), lower\(users\.first_name\)/);
  });

  it("keeps the aggregate private and renders every requested column", () => {
    expect(migration).toContain("revoke all on function public.admin_one_c_dashboard() from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.admin_one_c_dashboard() to service_role");
    expect(layout).toContain('<Link href="/admin/one-c-dashboard" prefetch={false}>Дашборд 1С</Link>');
    expect(page).toContain("Дата регистрации");
    expect(page).toContain("Дата последнего входа");
    expect(page).toContain("Дата последнего отыгранного кейса");
    expect(page).toContain("Кол-во сыгранных кейсов с даты регистрации");
    expect(page).toContain("Средний балл по всем отыгранным кейсам");
  });
});
