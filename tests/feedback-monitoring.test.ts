import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("feedback activity monitoring", () => {
  it("records feedback only after it is saved and includes its section", () => {
    const route = readFileSync("src/app/api/feedback/route.ts", "utf8");
    const feedbackInsert = route.indexOf('.from("user_feedback").insert');
    const activityCall = route.indexOf("await recordUserActivity({");

    expect(feedbackInsert).toBeGreaterThan(-1);
    expect(activityCall).toBeGreaterThan(feedbackInsert);
    expect(route).toContain('type: "feedback_submitted"');
    expect(route).toContain("subjectTitle: feedback.customSection || feedback.sectionLabel");
  });

  it("allows feedback events in the activity log", () => {
    const migration = readFileSync("supabase/migrations/20260807150000_feedback_activity_monitoring.sql", "utf8");

    expect(migration).toContain("'feedback_submitted'");
  });
});
