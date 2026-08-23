import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("case scenario conditions UI", () => {
  it("shows scenario conditions in both detailed case views", () => {
    const library = readFileSync(resolve(process.cwd(), "src/components/CaseLibrary.tsx"), "utf8");
    const arena = readFileSync(resolve(process.cwd(), "src/components/VoiceArena.tsx"), "utf8");

    const canonical = readFileSync(resolve(process.cwd(), "src/components/CaseCanonicalDetails.tsx"), "utf8");
    expect(library).toContain("CaseCanonicalDetails");
    expect(canonical).toContain("СЦЕНАРНЫЕ УСЛОВИЯ");
    expect(canonical).toContain("Не задано");
    expect(arena).toContain("СЦЕНАРНЫЕ УСЛОВИЯ");
    expect(arena).toContain("selectedCase.scenarioConditions");
  });

  it("offers the same structured fields in the case generator", () => {
    const builder = readFileSync(resolve(process.cwd(), "src/components/CaseBuilder.tsx"), "utf8");
    expect(builder).toContain("Заполнить подробные поля кейса");
    expect(builder).toContain("СЦЕНАРНЫЕ УСЛОВИЯ");
    expect(builder).toContain("ГРАНИЦЫ ПОЛНОМОЧИЙ");
    expect(builder).toContain("ТИПОВЫЕ ВОЗРАЖЕНИЯ");
    expect(builder).toContain("CaseCanonicalDetails");
  });

  it("lets an administrator edit the field", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/components/AdminCaseEditor.tsx"), "utf8");
    expect(editor).toContain("Сценарные условия — по одному на строке");
    expect(editor).toContain('set("scenarioConditions"');
  });
});
