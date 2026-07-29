import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260730120000_p2_development_velocity.sql", import.meta.url),
  "utf8",
);

describe("P2 database migration", () => {
  it.each([
    "get_rating_page",
    "purge_expired_training_data",
    "transcript_consent_at",
    "transcript_retention_days",
    "retention_expires_at",
  ])("defines %s", (contract) => {
    expect(migration).toContain(contract);
  });

  it("masks private case titles for non-owners inside SQL", () => {
    expect(migration).toContain("Приватный кейс пользователя");
    expect(migration).toMatch(/visibility = 'private'[\s\S]+owner_user_id is distinct from p_requesting_user_id/);
  });

  it("aggregates and paginates rating rows in the database", () => {
    expect(migration).toMatch(/jsonb_agg[\s\S]+limit 5/);
    expect(migration).toMatch(/limit greatest\(1, least\(coalesce\(p_limit, 25\), 100\)\)/);
    expect(migration).toContain("total_count");
  });
});
