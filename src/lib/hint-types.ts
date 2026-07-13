export type NegotiationHint = {
  direction: string;
  nextActions: string[];
  suggestedPhrases: string[];
  watchOut: string;
};

export function createNegotiationHintSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["direction", "nextActions", "suggestedPhrases", "watchOut"],
    properties: {
      direction: { type: "string", minLength: 20, maxLength: 900 },
      nextActions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 8, maxLength: 400 } },
      suggestedPhrases: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 8, maxLength: 500 } },
      watchOut: { type: "string", minLength: 8, maxLength: 500 },
    },
  } as const;
}
