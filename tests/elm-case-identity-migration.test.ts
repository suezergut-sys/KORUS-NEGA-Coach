import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260830190000_update_elm_case_identity.sql"),
  "utf8",
);

describe("ELM case identity migration", () => {
  it("renames the company and switches the conversation to informal address", () => {
    expect(migration).toContain("КОРУС Консалтинг");
    expect(migration).toContain("address_form = 'informal'");
    expect(migration).toContain("результаты твоей работы");
    expect(migration).toContain("для тебя сейчас наиболее важны");
    expect(migration).toContain("Соглашайся сейчас");
    expect(migration).not.toContain("результаты вашей работы");
  });

  it("forces a fresh comic media package after updating the canonical case", () => {
    expect(migration).toContain("public.enqueue_case_media_job(id, true)");
    expect(migration).toContain("where slug = 'elm-sales-manager-dismissal'");
  });
});
