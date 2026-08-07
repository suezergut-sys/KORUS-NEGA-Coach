import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("weekly Telegram digest", () => {
  it("loads product history and passes the reported week's improvements to the message", () => {
    const route = readFileSync("src/app/api/cron/weekly-activity/route.ts", "utf8");

    expect(route).toContain('import { PRODUCT_HISTORY } from "@/lib/about-product"');
    expect(route).toContain("platformUpdatesForWeek(week, PRODUCT_HISTORY)");
    expect(route).toContain("formatWeeklyActivitySummary(week, summary, updates)");
  });

  it("counts registrations separately while excluding registration-only users from active users", () => {
    const migration = readFileSync("supabase/migrations/20260807170000_weekly_registration_count.sql", "utf8");

    expect(migration).toMatch(/active_users[\s\S]+event_type <> 'user_registered'/);
    expect(migration).toMatch(/new_users[\s\S]+event_type = 'user_registered'/);
  });
});
