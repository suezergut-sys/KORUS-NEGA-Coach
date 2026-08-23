import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260823150000_lock_1c_manager_start.sql"), "utf8");

describe("locked 1C dismissal case start migration", () => {
  it("adds optional case-level restrictions without changing regular cases", () => {
    expect(migration).toContain("add column if not exists required_participant_role_index");
    expect(migration).toContain("add column if not exists required_first_speaker");
    expect(migration).toContain("where slug = '1c-dismissal'");
  });

  it("locks the 1C case to manager Maria and a participant-first start", () => {
    expect(migration).toContain("'Мария Соколова'");
    expect(migration).toContain("required_participant_role_index = 0");
    expect(migration).toContain("required_first_speaker = 'participant'");
  });
});
