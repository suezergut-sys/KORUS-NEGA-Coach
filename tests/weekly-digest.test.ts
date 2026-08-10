import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("weekly Telegram digest", () => {
  it("loads product history and passes the reported week's improvements to the message", () => {
    const route = readFileSync("src/app/api/cron/weekly-activity/route.ts", "utf8");

    expect(route).toContain('import { PRODUCT_HISTORY } from "@/lib/about-product"');
    expect(route).toContain("platformUpdatesForWeek(week, PRODUCT_HISTORY)");
    expect(route).toContain("formatWeeklyActivitySummary(week, summary, updates)");
  });

  it("counts registrations from profile creation dates while keeping activity event-based", () => {
    const migration = readFileSync("supabase/migrations/20260810110000_weekly_registrations_from_profiles.sql", "utf8");

    expect(migration).toMatch(/event_type <> 'user_registered'[\s\S]+as active_users/);
    expect(migration).toMatch(/new_users[\s\S]+from public\.user_profiles/);
    expect(migration).toMatch(/from public\.user_profiles[\s\S]+created_at >= p_period_start[\s\S]+created_at < p_period_end/);
    expect(migration).not.toMatch(/new_users[\s\S]+event_type = 'user_registered'/);
  });
});
