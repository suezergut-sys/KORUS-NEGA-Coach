import { describe, expect, it } from "vitest";
import { addTranscriptionItem, combineTranscriptionFragments } from "../src/lib/platform-test-transcription";

describe("platform test transcription aggregation", () => {
  it("keeps speech order even when transcription completions arrive out of order", () => {
    const order = addTranscriptionItem(addTranscriptionItem([], "item-1"), "item-2");
    const fragments = new Map([
      ["item-2", "до десяти рабочих дней?"],
      ["item-1", "Изменения не были своевременно согласованы"],
    ]);

    expect(combineTranscriptionFragments(order, fragments)).toBe(
      "Изменения не были своевременно согласованы до десяти рабочих дней?",
    );
  });

  it("does not duplicate item ids and normalizes fragment whitespace", () => {
    const order = addTranscriptionItem(addTranscriptionItem(["item-1"], "item-1"), "item-2");
    expect(order).toEqual(["item-1", "item-2"]);
    expect(combineTranscriptionFragments(order, new Map([
      ["item-1", "  Первая   часть,  "],
      ["item-2", " вторая часть. "],
    ]))).toBe("Первая часть, вторая часть.");
  });
});
