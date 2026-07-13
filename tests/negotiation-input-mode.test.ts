import { describe, expect, it } from "vitest";
import { shouldEnableMicrophone } from "../src/lib/negotiation-input-mode";

describe("режим микрофона переговоров", () => {
  it("держит микрофон включённым в дуплексе, кроме паузы", () => {
    expect(shouldEnableMicrophone("duplex", false, false)).toBe(true);
    expect(shouldEnableMicrophone("duplex", true, true)).toBe(false);
  });

  it("в режиме по кнопке включает микрофон только на время удержания", () => {
    expect(shouldEnableMicrophone("push_to_talk", false, false)).toBe(false);
    expect(shouldEnableMicrophone("push_to_talk", false, true)).toBe(true);
    expect(shouldEnableMicrophone("push_to_talk", true, true)).toBe(false);
  });
});
