import { describe, expect, it } from "vitest";
import { DEFAULT_CASE } from "../src/lib/default-case";
import { isCanonicalPersonName, normalizePersonName, toPublicCase } from "../src/lib/case-types";

describe("публичная модель кейса", () => {
  it("удаляет скрытые мотивы из всех ролей", () => {
    const publicCase = toPublicCase({
      ...DEFAULT_CASE,
      additionalRoles: [{ ...DEFAULT_CASE.opponentRole, name: "Анна-Мария О’Нил" }],
    });
    expect(publicCase.userRole.hiddenMotives).toEqual([]);
    expect(publicCase.opponentRole.hiddenMotives).toEqual([]);
    expect(publicCase.additionalRoles[0].hiddenMotives).toEqual([]);
  });
});

describe("Unicode-имена персонажей", () => {
  it("принимает составные и латинские имена", () => {
    expect(isCanonicalPersonName("Анна-Мария О’Нил")).toBe(true);
    expect(isCanonicalPersonName("John Smith")).toBe(true);
  });

  it("отвергает должность вместо ФИО", () => {
    expect(isCanonicalPersonName("Руководитель проекта")).toBe(false);
  });

  it("нормализует пробелы и составные Unicode-символы", () => {
    expect(normalizePersonName("  И\u0306рина   Соколова ")).toBe("Йрина Соколова");
  });
});
