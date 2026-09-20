import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOneCCaseBrief } from "@/lib/one-c-case-input";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("private 1C dismissal case builder", () => {
  it("normalizes predefined and custom scenario choices", () => {
    const brief = parseOneCCaseBrief({
      situation: "Нужно провести разговор с сотрудником на испытательном сроке и сообщить решение о расставании.",
      reasons: ["плохая дисциплина", "несуществующее значение"],
      otherReason: "не выполняет обязательства по проекту",
      profiles: ["спорит", "юридически подкован"],
      objections: ["просит директора"],
      otherObjection: "просит неделю на решение",
      agreementFrame: "Можно предложить один оклад, нельзя обещать продление испытательного срока.",
    });

    expect(brief.reasons).toEqual(["плохая дисциплина", "не выполняет обязательства по проекту"]);
    expect(brief.profiles).toEqual(["спорит", "юридически подкован"]);
    expect(brief.objections).toEqual(["просит директора", "просит неделю на решение"]);
  });

  it("requires enough context and an agreement frame", () => {
    expect(() => parseOneCCaseBrief({ situation: "Слишком кратко", agreementFrame: "один оклад" })).toThrow(/минимум 40/);
    expect(() => parseOneCCaseBrief({ situation: "Подробное описание разговора об увольнении сотрудника на испытательном сроке.", agreementFrame: "" })).toThrow(/что можно предлагать/);
  });

  it("enforces private publication and the 1C training contract on the server", () => {
    const publisher = source("src/lib/one-c-case-publisher.ts");
    expect(publisher).toContain('visibility: "private"');
    expect(publisher).toContain('required_methodology_id: "dismissal_1c"');
    expect(publisher).toContain("required_participant_role_index: 0");
    expect(publisher).toContain('required_first_speaker: "participant"');
    expect(publisher).toContain("owner_user_id: ownerUserId");
  });

  it("applies the 1C report policy by methodology, including user-created cases", () => {
    const analysis = source("src/app/api/analysis/route.ts");
    expect(analysis).toContain('if (methodologyId === "dismissal_1c") analysis = applyOneCDismissalSafetyPolicy(analysis)');
    expect(analysis).not.toContain('if (session.case_code === "1c-dismissal") analysis = applyOneCDismissalSafetyPolicy(analysis)');
  });

  it("keeps scenario checkboxes compact inside dropdown menus", () => {
    const styles = source("src/app/globals.css");
    expect(styles).toContain('.one-c-choice input:not([type="checkbox"])');
    expect(styles).toMatch(/\.one-c-choice input\[type="checkbox"\][^{]*\{[^}]*width:\s*16px/);
  });
});
