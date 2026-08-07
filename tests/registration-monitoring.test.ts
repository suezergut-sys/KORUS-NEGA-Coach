import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("registration activity monitoring", () => {
  it("records a registration only after the user profile is created", () => {
    const route = readFileSync("src/app/api/site/register/route.ts", "utf8");
    const profileInsert = route.indexOf('.from("user_profiles").insert');
    const activityCall = route.indexOf("await recordUserActivity({");

    expect(profileInsert).toBeGreaterThan(-1);
    expect(activityCall).toBeGreaterThan(profileInsert);
    expect(route).toContain('type: "user_registered"');
    expect(route).toContain("subjectTitle: email");
  });

  it("allows registration events without adding them to weekly active users", () => {
    const migration = readFileSync("supabase/migrations/20260807120000_user_registration_monitoring.sql", "utf8");

    expect(migration).toContain("'user_registered'");
    expect(migration).toMatch(/active_users[\s\S]+event_type <> 'user_registered'/);
  });
});

