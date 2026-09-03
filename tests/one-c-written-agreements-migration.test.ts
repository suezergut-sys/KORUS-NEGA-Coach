import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903203000_refine_1c_written_agreements.sql"),
  "utf8",
);
const publisher = readFileSync(resolve(process.cwd(), "scripts/publish-1c-dismissal-case.mjs"), "utf8");

describe("устные договорённости в кейсе и методологии 1С", () => {
  it("добавляет правило в канонический кейс 1С", () => {
    expect(migration).toContain("where slug = '1c-dismissal'");
    expect(migration).toContain("Договорённости в рамках первого разговора остаются устными");
    expect(migration).toContain("Предложение руководителя письменно зафиксировать договорённости первого разговора");
    expect(migration).toContain("Устно согласовать следующий контакт");
  });

  it("добавляет отдельный кандидатный критерий в методологию SRC-004", () => {
    expect(migration).toMatch(/\$content\$\)\)\r?\ninsert into public\.document_chunks/);
    expect(migration).toContain("where source.code = 'SRC-004'");
    expect(migration).toContain("'evaluation_criterion'");
    expect(migration).toContain("'Не предлагать письменную фиксацию договорённостей'");
    expect(migration).toContain("'dismissal-1c-v0-candidate'");
    expect(migration).toContain("'candidate'");
  });

  it("отделяет ошибку руководителя от обязательного кадрового оформления", () => {
    expect(migration).toContain("обязательное кадровое оформление прекращения трудовых отношений");
    expect(migration).toContain("обязательные кадровые документы оцениваются отдельно");
  });

  it("не публикует неполный кейс или методологию прежнего размера", () => {
    expect(publisher).toContain("Договорённости в рамках первого разговора остаются устными");
    expect(publisher).toContain("(count || 0) < 22");
  });
});
