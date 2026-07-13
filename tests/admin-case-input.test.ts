import { describe, expect, it } from "vitest";
import { parseAdminCaseInput } from "../src/lib/admin-case-input";

const baseRole = {
  name: "Ирина Соколова",
  position: "Руководитель проекта",
  voiceGender: "female",
  publicGoal: "Согласовать новый план",
  interests: ["Сохранить клиента"],
  constraints: ["Срок — неделя"],
  hiddenMotives: [],
  leverage: ["Распределение ресурсов"],
};

function validCase() {
  return {
    title: "Сложный проект",
    summary: "Краткое описание",
    situation: "Описание ситуации",
    conflict: "Несовместимые интересы",
    startSituation: "Оппонент отрицает проблему",
    difficultyReason: "Высокие ставки",
    status: "published",
    origin: "builder",
    createdBy: "AI-конструктор · user@example.com",
    userRole: baseRole,
    opponentRole: { ...baseRole, name: "Алексей Воронцов", voiceGender: "male" },
    additionalRoles: [],
    stakes: ["Репутация"],
    evaluationFocus: ["Работа с интересами"],
    methodologyBasis: [],
  };
}

describe("parseAdminCaseInput", () => {
  it("accepts and normalizes a complete case", () => {
    const result = parseAdminCaseInput(validCase());
    expect(result.title).toBe("Сложный проект");
    expect(result.userRole.name).toBe("Ирина Соколова");
    expect(result.createdBy).toContain("user@example.com");
  });

  it("rejects duplicate role names", () => {
    const item = validCase();
    item.opponentRole = { ...baseRole, voiceGender: "male" };
    expect(() => parseAdminCaseInput(item)).toThrow("разные имена");
  });

  it("rejects incomplete canonical roles", () => {
    const item = validCase();
    item.userRole = { ...baseRole, name: "Ирина" };
    expect(() => parseAdminCaseInput(item)).toThrow("имя и фамилия");
  });
});
