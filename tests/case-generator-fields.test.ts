import { describe, expect, it } from "vitest";
import { emptyCaseGeneratorFields, formatCaseGeneratorFields } from "@/lib/case-generator-fields";

describe("structured case generator fields", () => {
  it("passes explicitly filled scenario counters and role rules to generation", () => {
    const fields = emptyCaseGeneratorFields();
    fields.scenarioConditions = "Возразить не менее трёх раз\nПеребить участника ровно один раз";
    fields.authorityLimits = "Не обещать больше одного оклада";
    fields.roles[1].name = "Алексей Морозов";
    fields.roles[1].typicalObjections = "Почему именно я?";

    const text = formatCaseGeneratorFields(fields, 2);

    expect(text).toContain("Обязательные сценарные условия, включая точное число действий или перебиваний");
    expect(text).toContain("Возразить не менее трёх раз");
    expect(text).toContain("Перебить участника ровно один раз");
    expect(text).toContain("Не обещать больше одного оклада");
    expect(text).toContain("Алексей Морозов");
    expect(text).toContain("Почему именно я?");
  });

  it("does not turn empty fields into negotiation rules", () => {
    expect(formatCaseGeneratorFields(emptyCaseGeneratorFields(), 2)).toBe("");
  });
});
