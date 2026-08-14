import { describe, expect, it } from "vitest";
import { detectRequestedCaseRoleCount, parseCaseRoleCount } from "../src/lib/case-role-count";
import { createCaseVariantsSchema } from "../src/lib/case-types";

describe("case role count", () => {
  it("recognizes explicit Russian requests for three roles", () => {
    expect(detectRequestedCaseRoleCount("Создай кейс с тремя ролями и разными интересами.")).toBe(3);
    expect(detectRequestedCaseRoleCount("Добавь третью роль — руководителя качества.")).toBe(3);
    expect(detectRequestedCaseRoleCount("Нужны 3 участника переговоров.")).toBe(3);
  });

  it("uses the last explicit count when the user corrects themselves", () => {
    expect(detectRequestedCaseRoleCount("Сначала думал про две роли, но сделай три роли.")).toBe(3);
  });

  it("accepts only supported explicit selector values", () => {
    expect(parseCaseRoleCount("3")).toBe(3);
    expect(parseCaseRoleCount("5")).toBeUndefined();
    expect(parseCaseRoleCount("")).toBeUndefined();
  });

  it("requires exactly one additional role in a three-role model response", () => {
    const schema = createCaseVariantsSchema([], 2, 3);
    const additionalRoles = schema.properties.variants.items.properties.additionalRoles;
    expect(additionalRoles.minItems).toBe(1);
    expect(additionalRoles.maxItems).toBe(1);
  });
});
