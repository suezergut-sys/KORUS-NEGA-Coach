import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260830120000_seed_elm_department_case.sql"),
  "utf8",
);

describe("ELM department case migration", () => {
  it("creates the assignable ELM department and publishes the case only for it", () => {
    expect(migration).toContain("'elm', 'ELM'");
    expect(migration).toContain("'elm-sales-manager-dismissal'");
    expect(migration).toContain("'published'");
    expect(migration).toContain("'department'");
    expect(migration).toContain("'e1a00001-0000-4000-8000-000000000001'");
  });

  it("locks the participant to the company negotiator and makes them start", () => {
    expect(migration).toContain('"name":"Переговорщик компании"');
    expect(migration).toContain("required_participant_role_index");
    expect(migration).toContain("required_first_speaker");
    expect(migration).toContain("'participant'");
  });

  it("keeps the employee as the AI opponent and carries the source document details", () => {
    expect(migration).toContain('"name":"Алексей Воронов"');
    expect(migration).toContain("Цикл корпоративных продаж длинный");
    expect(migration).toContain("Маркетинг почти не давал готовых лидов");
    expect(migration).toContain("продолжать выполнять работу по трудовому договору");
    expect(migration).toContain("scenario_conditions");
    expect(migration).toContain("decision_terms");
    expect(migration).toContain("authority_limits");
    expect(migration).toContain("risk_zones");
  });
});
