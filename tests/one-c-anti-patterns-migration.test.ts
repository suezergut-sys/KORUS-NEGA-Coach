import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260902224000_add_1c_anti_patterns.sql"), "utf8");

describe("антиприёмы методологии 1С", () => {
  it("расширяет ограничение типа атома", () => {
  expect(migration).toContain("'anti_pattern'");
  expect(migration).toContain("$content$))\ninsert into public.document_chunks");
    expect(migration).toContain("add constraint method_atoms_kind_check");
  });

  it("добавляет все 13 техник только в источник SRC-004", () => {
    expect(migration.match(/'1c2000[0-9a-d]{2}-0000-4000-8000-0000000000[0-9a-d]{2}'::uuid/g)).toHaveLength(13);
    expect(migration).toContain("where source.code = 'SRC-004'");
    expect(migration).toContain("'Давление срочностью'");
    expect(migration).toContain("'Показная жёсткость и игра на страхе'");
  });

  it("оставляет новые атомы кандидатными для проверки методистом", () => {
    expect(migration).toContain("'dismissal-1c-v0-candidate', 'candidate'");
    expect(migration).toContain("требуется проверка методистом");
  });
});
