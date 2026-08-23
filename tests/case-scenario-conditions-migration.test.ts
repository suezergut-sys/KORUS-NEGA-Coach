import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260823170000_case_scenario_conditions.sql"), "utf8");

describe("case scenario conditions migration", () => {
  it("adds an empty-by-default field to drafts and published cases", () => {
    expect(migration).toContain("public.case_variants");
    expect(migration).toContain("public.negotiation_cases");
    expect(migration.match(/scenario_conditions jsonb not null default '\[\]'::jsonb/g)).toHaveLength(2);
  });

  it("requires three distinct dismissal objections in the 1C system case", () => {
    expect(migration).toContain("where slug = '1c-dismissal'");
    expect(migration).toContain("не менее трёх разных содержательных возражений");
    expect(migration).toContain("не принимать условия расставания раньше третьего возражения");
  });

  it("preserves scenario conditions when a generated variant is published", () => {
    expect(migration).toContain("methodology_basis, scenario_conditions, decision_terms");
    expect(migration).toContain("scenario_conditions = excluded.scenario_conditions");
  });
});
