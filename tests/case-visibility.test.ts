import { describe, expect, it } from "vitest";
import { canAccessCase, parseCaseVisibility } from "../src/lib/case-visibility";

describe("видимость пользовательских кейсов", () => {
  it("принимает только поддерживаемые варианты видимости", () => {
    expect(parseCaseVisibility("public")).toBe("public");
    expect(parseCaseVisibility("private")).toBe("private");
    expect(parseCaseVisibility("department")).toBeNull();
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
    expect(canAccessCase(privateCase, { userId: "admin", isAdministrator: true })).toBe(false);
  });

  it("сохраняет публичное поведение исторических строк без поля visibility", () => {
    expect(canAccessCase({}, "any-user")).toBe(true);
  });

  it("открывает ведомственный кейс только своему департаменту и администраторам", () => {
    const departmentCase = { visibility: "department", department_id: "department-1" };
    expect(canAccessCase(departmentCase, { userId: "user-1", departmentId: "department-1" })).toBe(true);
    expect(canAccessCase(departmentCase, { userId: "user-2", departmentId: "department-2" })).toBe(false);
    expect(canAccessCase(departmentCase, { userId: "admin", isAdministrator: true })).toBe(true);
  });
});
