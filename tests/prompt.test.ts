import { describe, expect, it } from "vitest";
import { buildRealtimeInstructions, type SessionInput } from "../src/lib/prompt";

const baseInput: Omit<SessionInput, "negotiationStyle"> = {
  role: "Алексей Воронцов, руководитель",
  context: "Обсуждение сроков проекта.",
};

describe("стили Realtime-переговоров", () => {
  it("даёт жёсткому оппоненту напор и ограничивает перебивания", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "hard" });
    expect(prompt).toContain("ЖЁСТКИЕ ПЕРЕГОВОРЫ");
    expect(prompt).toContain("не чаще одного раза на пять");
  });

  it("запрещает намеренно перебивать в стиле сотрудничества", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative" });
    expect(prompt).toContain("СОТРУДНИЧЕСТВО");
    expect(prompt).toContain("Не перебивай собеседника намеренно");
  });
});
