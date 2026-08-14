import { describe, expect, it } from "vitest";
import { buildCaseRevisionInput, CASE_REVISION_MAX_LENGTH, parseCaseRevisionInstructions } from "../src/lib/case-revision";
import { createCaseVariantsSchema, type GeneratedCaseVariant } from "../src/lib/case-types";

const variant: GeneratedCaseVariant = {
  title: "Старое название",
  summary: "Руководители согласуют ресурсы.",
  situation: "Исходная ситуация.",
  conflict: "Конфликт ресурсов.",
  userRole: { name: "Анна Ларина", position: "Руководитель проекта", voiceGender: "female", publicGoal: "Получить ресурс", interests: ["Срок"], constraints: ["Бюджет"], hiddenMotives: ["Повышение"], leverage: ["Поддержка заказчика"] },
  opponentRole: { name: "Илья Романов", position: "Руководитель отдела", voiceGender: "male", publicGoal: "Сохранить ресурс", interests: ["Качество"], constraints: ["Загрузка"], hiddenMotives: ["Репутация"], leverage: ["Экспертиза"] },
  additionalRoles: [],
  stakes: ["Срок запуска"],
  startSituation: "Илья отказывает.",
  difficultyReason: "Обе стороны отвечают за результат.",
  evaluationFocus: ["Разведка интересов"],
  methodologyBasis: [{ atomId: "atom-1", title: "Правило", application: "Проверка позиций" }],
};

describe("case variant revision", () => {
  it("requires meaningful bounded correction text", () => {
    expect(() => parseCaseRevisionInstructions("  ")).toThrow("Опишите, что нужно изменить");
    expect(parseCaseRevisionInstructions(`  ${"а".repeat(CASE_REVISION_MAX_LENGTH + 20)}  `)).toHaveLength(CASE_REVISION_MAX_LENGTH);
  });

  it("passes the complete selected variant and user corrections to the model", () => {
    const input = buildCaseRevisionInput(variant, "Измените название и уточните интерес Анны.");
    expect(input).toContain('"title": "Старое название"');
    expect(input).toContain('"hiddenMotives"');
    expect(input).toContain("Измените название и уточните интерес Анны.");
  });

  it("uses a strict one-variant schema for the corrected version", () => {
    const schema = createCaseVariantsSchema(["atom-1"], 1, 3);
    expect(schema.properties.variants.minItems).toBe(1);
    expect(schema.properties.variants.maxItems).toBe(1);
    expect(schema.properties.variants.items.properties.additionalRoles.minItems).toBe(1);
    expect(schema.properties.variants.items.properties.additionalRoles.maxItems).toBe(1);
  });
});
