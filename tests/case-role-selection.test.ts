import { describe, expect, it } from "vitest";
import { DEFAULT_CASE } from "../src/lib/default-case";
import { selectCaseRoles } from "../src/lib/case-role-selection";

describe("three-role case selection", () => {
  it("allows the participant to play the third role", () => {
    const thirdRole = { ...DEFAULT_CASE.opponentRole, name: "Мария Орлова", position: "Руководитель службы качества" };
    const selected = selectCaseRoles({ ...DEFAULT_CASE, additionalRoles: [thirdRole] }, 2, 0);
    expect(selected.roles).toHaveLength(3);
    expect(selected.participantRole).toBe(thirdRole);
    expect(selected.opponentRole).toBe(DEFAULT_CASE.userRole);
    expect(selected.participantRoleIndex).toBe(2);
  });
});
