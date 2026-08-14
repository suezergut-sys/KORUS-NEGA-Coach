import { describe, expect, it } from "vitest";
import { DEFAULT_CASE } from "../src/lib/default-case";
import { selectCaseRoles } from "../src/lib/case-role-selection";

describe("three-role case selection", () => {
  it("allows the participant to play the third role", () => {
    const thirdRole = { ...DEFAULT_CASE.opponentRole, name: "Мария Орлова", position: "Руководитель службы качества" };
    const selected = selectCaseRoles({ ...DEFAULT_CASE, additionalRoles: [thirdRole], negotiationPairs: [{ roleAIndex: 0, roleBIndex: 2, reason: "У ролей есть прямой конфликт интересов." }] }, 2, 0);
    expect(selected.roles).toHaveLength(3);
    expect(selected.participantRole).toBe(thirdRole);
    expect(selected.opponentRole).toBe(DEFAULT_CASE.userRole);
    expect(selected.participantRoleIndex).toBe(2);
  });

  it("rejects an opponent outside the role's allowed negotiation pairs", () => {
    const hrbp = { ...DEFAULT_CASE.opponentRole, name: "Наталья Салтыкова", position: "HRBP направления" };
    const item = {
      ...DEFAULT_CASE,
      additionalRoles: [hrbp],
      negotiationPairs: [
        { roleAIndex: 0, roleBIndex: 1, reason: "Руководитель и сотрудник согласуют условия увольнения." },
        { roleAIndex: 1, roleBIndex: 2, reason: "Сотрудник и HRBP согласуют процедуру и компенсацию." },
      ],
    };
    const selected = selectCaseRoles(item, 2, 0);
    expect(selected.opponentIndices).toEqual([1]);
    expect(selected.opponentRoleIndex).toBe(1);
    expect(selected.negotiationReason).toContain("процедуру");
  });
});
