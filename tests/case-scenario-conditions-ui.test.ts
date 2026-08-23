import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("case scenario conditions UI", () => {
  it("shows scenario conditions in both detailed case views", () => {
    const library = readFileSync(resolve(process.cwd(), "src/components/CaseLibrary.tsx"), "utf8");
    const arena = readFileSync(resolve(process.cwd(), "src/components/VoiceArena.tsx"), "utf8");

    expect(library).toContain("СЦЕНАРНЫЕ УСЛОВИЯ");
    expect(library).toContain("selected.scenarioConditions");
    expect(arena).toContain("СЦЕНАРНЫЕ УСЛОВИЯ");
    expect(arena).toContain("selectedCase.scenarioConditions");
  });

  it("lets an administrator edit the field", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/components/AdminCaseEditor.tsx"), "utf8");
    expect(editor).toContain("Сценарные условия — по одному на строке");
    expect(editor).toContain('set("scenarioConditions"');
  });
});
