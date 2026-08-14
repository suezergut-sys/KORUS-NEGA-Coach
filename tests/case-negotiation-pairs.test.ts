import { describe, expect, it } from "vitest";
import { DEFAULT_CASE } from "../src/lib/default-case";
import { assertNegotiationPairs, cycleOpponentIndex, opponentIndicesForRole } from "../src/lib/case-negotiation-pairs";

const dismissalCase = {
  ...DEFAULT_CASE,
  additionalRoles: [{ ...DEFAULT_CASE.opponentRole, name: "Наталья Салтыкова", position: "HRBP направления" }],
  negotiationPairs: [
    { roleAIndex: 0, roleBIndex: 1, reason: "Руководитель и сотрудник согласуют условия увольнения." },
    { roleAIndex: 1, roleBIndex: 2, reason: "Сотрудник и HRBP согласуют процедуру и компенсацию." },
  ],
};

describe("case negotiation pairs", () => {
  it("returns only direct opponents for each role", () => {
    expect(opponentIndicesForRole(dismissalCase, 0)).toEqual([1]);
    expect(opponentIndicesForRole(dismissalCase, 1)).toEqual([0, 2]);
    expect(opponentIndicesForRole(dismissalCase, 2)).toEqual([1]);
  });

  it("cycles through allowed opponents in both directions", () => {
    expect(cycleOpponentIndex([0, 2], 0, 1)).toBe(2);
    expect(cycleOpponentIndex([0, 2], 0, -1)).toBe(2);
  });

  it("requires every role to have a direct negotiation pair", () => {
    expect(() => assertNegotiationPairs([{ roleAIndex: 0, roleBIndex: 1, reason: "Прямой конфликт двух ролей." }], 3)).toThrow(/Каждая роль/);
  });
});
