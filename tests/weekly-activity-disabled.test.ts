import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("disabled weekly Telegram report", () => {
  it("has no scheduled jobs or executable API routes", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons.map((job) => job.path)).not.toContain("/api/cron/weekly-activity");
    expect(config.crons.map((job) => job.path)).not.toContain("/api/cron/weekly-activity-fallback");
    expect(existsSync("src/app/api/cron/weekly-activity/route.ts")).toBe(false);
    expect(existsSync("src/app/api/cron/weekly-activity-fallback/route.ts")).toBe(false);
  });

  it("does not advertise the obsolete weekly chat setting", () => {
    expect(readFileSync(".env.example", "utf8")).not.toContain("TELEGRAM_WEEKLY_CHAT_ID");
  });
});
