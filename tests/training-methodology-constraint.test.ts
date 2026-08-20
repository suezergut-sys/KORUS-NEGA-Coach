import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260820194000_allow_conflicts_training_methodology.sql", import.meta.url),
  "utf8",
);
const sessionsRoute = readFileSync(
  new URL("../src/app/api/sessions/route.ts", import.meta.url),
  "utf8",
);

describe("training session methodology constraint", () => {
  it("allows every methodology exposed to participants", () => {
    expect(migration).toContain("drop constraint if exists training_sessions_methodology_id_check");
    expect(migration).toContain("methodology_id in ('tarasov', 'harvard', 'conflicts')");
  });

  it("does not expose raw database errors to participants", () => {
    expect(sessionsRoute).toContain('console.error("Training session creation failed", { code: error.code || "unknown" })');
    expect(sessionsRoute).not.toContain("if (error) throw new Error(error.message)");
  });
});
