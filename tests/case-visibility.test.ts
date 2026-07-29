import { describe, expect, it } from "vitest";
import { canAccessCase, parseCaseVisibility } from "../src/lib/case-visibility";

describe("видимость пользовательских кейсов", () => {
  it("принимает только поддерживаемые варианты видимости", () => {
    expect(parseCaseVisibility("public")).toBe("public");
    expect(parseCaseVisibility("private")).toBe("private");
    expect(parseCaseVisibility("hidden")).toBeNull();
  });

  it("разрешает общедоступный кейс любому участнику", () => {
    expect(canAccessCase({ visibility: "public", owner_user_id: "owner" }, "another-user")).toBe(true);
  });

  it("разрешает приватный кейс только владельцу", () => {
    const privateCase = { visibility: "private", owner_user_id: "owner" };
    expect(canAccessCase(privateCase, "owner")).toBe(true);
    expect(canAccessCase(privateCase, "another-user")).toBe(false);
    expect(canAccessCase(privateCase, null)).toBe(false);
  });

  it("сохраняет публичное поведение исторических строк без поля visibility", () => {
    expect(canAccessCase({}, "any-user")).toBe(true);
  });
});
