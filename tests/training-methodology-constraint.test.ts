import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260823120000_department_case_methodology.sql", import.meta.url),
  "utf8",
);
const sessionsRoute = readFileSync(
  new URL("../src/app/api/sessions/route.ts", import.meta.url),
  "utf8",
);

describe("training session methodology constraint", () => {
  it("allows public methodologies and the case-scoped 1C methodology", () => {
    expect(migration).toContain("drop constraint if exists training_sessions_methodology_id_check");
    expect(migration).toContain("methodology_id in ('tarasov', 'harvard', 'conflicts', 'dismissal_1c')");
  });

  it("does not expose raw database errors to participants", () => {
    expect(sessionsRoute).toContain('console.error("Training session creation failed", { code: error.code || "unknown" })');
    expect(sessionsRoute).not.toContain("if (error) throw new Error(error.message)");
  });
});
