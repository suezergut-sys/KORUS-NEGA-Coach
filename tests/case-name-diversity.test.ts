import { describe, expect, it } from "vitest";
import { assertDistinctCaseCharacterNames, blockedCaseCharacterNames, recentCaseCharacterNames } from "../src/lib/case-name-diversity";
import type { GeneratedCaseVariant } from "../src/lib/case-types";

function variant(names: string[]): GeneratedCaseVariant {
  const role = (name: string, voiceGender: "female" | "male") => ({
    name,
    position: "Руководитель направления",
    voiceGender,
    publicGoal: "Согласовать решение",
    interests: ["Результат"],
    constraints: ["Срок"],
    hiddenMotives: [],
    leverage: ["Экспертиза"],
  });
  return {
    title: "Тест",
    summary: "Два руководителя согласуют решение.",
    situation: "Рабочая ситуация.",
    conflict: "Несовместимые позиции.",
    addressForm: "formal",
    userRole: role(names[0], "female"),
    opponentRole: role(names[1], "male"),
    additionalRoles: [],
    negotiationPairs: [{ roleAIndex: 0, roleBIndex: 1, reason: "У ролей есть прямой конфликт интересов." }],
    stakes: ["Срок"],
    startSituation: "Начало разговора",
    difficultyReason: "Нет очевидного компромисса",
    evaluationFocus: ["Интересы"],
    methodologyBasis: [],
  };
}

describe("diversity of generated case character names", () => {
  it("collects unique character names from recent cases", () => {
    expect(recentCaseCharacterNames([{
      user_role: { name: "Марина Лебедева" },
      opponent_role: { name: "Тимур Хабибуллин" },
      additional_roles: [{ name: "Марина Лебедева" }],
    }])).toEqual(["Марина Лебедева", "Тимур Хабибуллин"]);
  });

  it("always blocks legacy defaults but permits a person explicitly named in source materials", () => {
    expect(blockedCaseCharacterNames([], "")).toMatchObject({
      fullNames: ["Ирина Соколова", "Алексей Воронцов"],
      firstNames: ["Ирина", "Алексей"],
    });
    expect(blockedCaseCharacterNames(["Марина Лебедева"], "Марина Лебедева участвует в переговорах").fullNames)
      .not.toContain("Марина Лебедева");
  });

  it("does not reject names reused in recent cases or between generated variants", () => {
    const blocked = blockedCaseCharacterNames(["Марина Лебедева"], "");
    expect(() => assertDistinctCaseCharacterNames([
      variant(["Марина Лебедева", "Тимур Хабибуллин"]),
      variant(["Оксана Белова", "Егор Поляков"]),
    ])).not.toThrow();
    expect(blocked.fullNames).toContain("Марина Лебедева");
    expect(() => assertDistinctCaseCharacterNames([
      variant(["Оксана Чернова", "Роман Ковалёв"]),
      variant(["Оксана Белова", "Роман Ковалёв"]),
    ])).not.toThrow();
  });

  it("rejects only identical full names inside one case", () => {
    expect(() => assertDistinctCaseCharacterNames([
      variant(["Алексей Носов", "Алексей Носов"]),
    ])).toThrow("разные полные имена");

    expect(() => assertDistinctCaseCharacterNames([
      variant(["Алексей Носов", "Алексей Орлов"]),
    ])).not.toThrow();
  });
});
