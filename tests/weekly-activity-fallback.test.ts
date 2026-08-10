import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("weekly activity fallback", () => {
  it("reuses the idempotent weekly report handler", () => {
    const fallbackRoute = readFileSync("src/app/api/cron/weekly-activity-fallback/route.ts", "utf8");

    expect(fallbackRoute).toContain('import { GET as sendWeeklyActivityReport } from "../weekly-activity/route"');
    expect(fallbackRoute).toContain('export const runtime = "nodejs"');
    expect(fallbackRoute).toContain("return sendWeeklyActivityReport(request)");
  });

  it("checks delivery daily after the primary Monday schedule", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/cron/weekly-activity",
      schedule: "0 6 * * 1",
    });
    expect(config.crons).toContainEqual({
      path: "/api/cron/weekly-activity-fallback",
      schedule: "0 9 * * *",
    });
  });
});
