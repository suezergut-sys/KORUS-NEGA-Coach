import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260823120000_department_case_methodology.sql"), "utf8");

describe("department-restricted 1C dismissal case migration", () => {
  it("creates a nullable user department and a department-only access mode", () => {
    expect(migration).toContain("create table if not exists public.departments");
    expect(migration).toContain("add column if not exists department_id uuid references public.departments");
    expect(migration).toContain("visibility in ('public', 'private', 'department')");
    expect(migration).toContain("visibility <> 'department' or department_id is not null");
  });

  it("seeds the case as a safe draft before the compatible application is released", () => {
    expect(migration).toContain("'1c-dismissal'");
    expect(migration).toContain("'dismissal_1c'");
    expect(migration).toContain("'department'");
    expect(migration).toContain("'draft'");
    expect(migration).toContain("Если не подпишешь, будет хуже.");
  });

  it("keeps user-created cases limited to public and private visibility", () => {
    expect(migration).toContain("if p_visibility not in ('public', 'private')");
  });
});
