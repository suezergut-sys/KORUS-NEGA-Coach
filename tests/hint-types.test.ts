import { describe, expect, it } from "vitest";
import { createNegotiationHintSchema } from "../src/lib/hint-types";

describe("структурированная подсказка", () => {
  it("требует направление, действия, формулировки и предупреждение", () => {
    const schema = createNegotiationHintSchema();
    expect(schema.required).toEqual(["direction", "nextActions", "suggestedPhrases", "watchOut"]);
    expect(schema.properties.nextActions.minItems).toBe(2);
    expect(schema.properties.suggestedPhrases.minItems).toBe(2);
    expect(schema.additionalProperties).toBe(false);
  });
});
