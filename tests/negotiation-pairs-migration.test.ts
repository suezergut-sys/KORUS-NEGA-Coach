import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260814140500_negotiation_role_pairs.sql", import.meta.url),
  "utf8",
);

describe("negotiation pairs migration", () => {
  it("stores pairs in variants and published cases and copies them on approval", () => {
    expect(migration).toContain("add column if not exists negotiation_pairs");
    expect(migration).toMatch(/additional_roles, negotiation_pairs, stakes/);
    expect(migration).toContain("negotiation_pairs = excluded.negotiation_pairs");
  });

  it("excludes the conflict-free manager and HRBP pair in the dismissal case", () => {
    const dismissalUpdate = migration.split("where title = 'Непростое увольнение'")[0].split("update public.negotiation_cases").at(-1) || "";
    expect(dismissalUpdate).toContain("'roleAIndex', 0");
    expect(dismissalUpdate).toContain("'roleBIndex', 1");
    expect(dismissalUpdate).toContain("'roleAIndex', 1");
    expect(dismissalUpdate).toContain("'roleBIndex', 2");
    expect(dismissalUpdate).not.toContain("'roleAIndex', 0, 'roleBIndex', 2");
  });
});
