import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260729210000_p1_learning_reliability.sql", import.meta.url),
  "utf8",
);

describe("P1 persistence migration", () => {
  it.each([
    "finalize_training_session",
    "claim_training_analysis",
    "session_metrics",
    "user_learning_goals",
    "practice_tasks",
    "enqueue_case_media_job",
    "claim_case_media_job",
    "schedule_case_media_retry",
  ])("defines %s", (contract) => {
    expect(migration).toContain(contract);
  });

  it("keeps service-role execution grants for atomic RPCs", () => {
    expect(migration).toMatch(/grant execute on function public\.finalize_training_session[\s\S]+to service_role/);
    expect(migration).toMatch(/grant execute on function public\.schedule_case_media_retry[\s\S]+to service_role/);
  });
});
