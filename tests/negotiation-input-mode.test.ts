import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEGOTIATION_INPUT_MODE,
  initialNegotiationInputMode,
  NEGOTIATION_INPUT_MODE_OPTIONS,
  shouldEnableMicrophone,
} from "../src/lib/negotiation-input-mode";

describe("режим микрофона переговоров", () => {
  it("показывает текстовый режим первым и выбирает его по умолчанию", () => {
    expect(DEFAULT_NEGOTIATION_INPUT_MODE).toBe("text_only");
    expect(initialNegotiationInputMode()).toBe("text_only");
    expect(initialNegotiationInputMode(true)).toBe("duplex");
    expect(NEGOTIATION_INPUT_MODE_OPTIONS.map((option) => option.mode)).toEqual([
      "text_only",
      "push_to_talk",
      "duplex",
    ]);
    expect(NEGOTIATION_INPUT_MODE_OPTIONS.map((option) => option.label)).toEqual([
      "Только текст",
      "Обычный",
      "Дуплекс",
    ]);
  });
  it("держит микрофон включённым в дуплексе, кроме паузы", () => {
    expect(shouldEnableMicrophone("duplex", false, false)).toBe(true);
    expect(shouldEnableMicrophone("duplex", true, true)).toBe(false);
    expect(shouldEnableMicrophone("text_only", false, true)).toBe(false);
  });

  it("в режиме по кнопке включает микрофон только на время удержания", () => {
    expect(shouldEnableMicrophone("push_to_talk", false, false)).toBe(false);
    expect(shouldEnableMicrophone("push_to_talk", false, true)).toBe(true);
    expect(shouldEnableMicrophone("push_to_talk", true, true)).toBe(false);
  });
});
