import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903120000_hide_1c_dismissal_meeting_purpose.sql"),
  "utf8",
);

describe("1C dismissal meeting purpose", () => {
  it("keeps the dismissal topic unknown until the manager discloses it", () => {
    expect(migration).toContain("where slug = '1c-dismissal'");
    expect(migration).toContain("руководитель просто вызвал его на разговор без повестки");
    expect(migration).toContain("не должен показывать, что знает или предполагает эту тему");
    expect(migration).toContain("На нейтральное приветствие, вопрос «как дела?» или small talk");
  });

  it("starts the existing objections only after the purpose is explicit", () => {
    expect(migration).toContain("Сразу после явного раскрытия руководителем темы увольнения");
    expect(migration).toContain("переходит к возражениям и далее выполняет остальные сценарные условия");
    expect(migration).toContain(") || scenario_conditions");
  });
});
