import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("duel analysis form", () => {
  it("accepts either an uploaded case file or pasted case text", () => {
    const page = readFileSync("src/app/analyze/page.tsx", "utf8");

    expect(page).toContain('type CaseSource = "file" | "text"');
    expect(page).toContain("ВСТАВИТЬ ТЕКСТ");
    expect(page).toContain('aria-label="Текст кейса"');
    expect(page).toContain('new File([caseText.trim()], "вставленный-кейс.txt"');
    expect(page).toContain('disabled={!caseInputReady || busy');
  });
});
