import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260812141935_include_admins_in_rating.sql", import.meta.url),
  "utf8",
);

describe("administrator rating visibility", () => {
  it("builds the rating from every participant profile without filtering by role", () => {
    expect(migration).toContain("from public.user_profiles profiles");
    expect(migration).not.toMatch(/profiles\.role\s*(?:=|<>|!=|in\b)/i);
  });

  it("keeps the existing rating aggregation and privacy behavior", () => {
    expect(migration).toContain("sessions.is_ranked = true");
    expect(migration).toContain("sessions.status = 'analyzed'");
    expect(migration).toContain("Приватный кейс пользователя");
    expect(migration).toContain("total_count");
  });
});
