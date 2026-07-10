export type AnalysisEvidence = {
  turnQuote: string;
  sourceQuote: string;
  section: string;
  rationale: string;
  confidence: number;
};

export type NegotiationAnalysis = {
  methodologyStatus: "candidate" | "verified";
  methodologyVersion: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  risks: string[];
  turningPoints: Array<{ moment: string; assessment: string }>;
  stratagems: Array<{
    name: string;
    status: "observed" | "possible" | "missed";
    explanation: string;
  }>;
  alternatives: string[];
  evidence: AnalysisEvidence[];
  disclaimer: string;
};

export const negotiationAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "methodologyStatus",
    "methodologyVersion",
    "overallScore",
    "summary",
    "strengths",
    "risks",
    "turningPoints",
    "stratagems",
    "alternatives",
    "evidence",
    "disclaimer",
  ],
  properties: {
    methodologyStatus: { type: "string", enum: ["candidate", "verified"] },
    methodologyVersion: { type: "string" },
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
    risks: { type: "array", items: { type: "string" }, maxItems: 5 },
    turningPoints: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["moment", "assessment"],
        properties: { moment: { type: "string" }, assessment: { type: "string" } },
      },
    },
    stratagems: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "status", "explanation"],
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["observed", "possible", "missed"] },
          explanation: { type: "string" },
        },
      },
    },
    alternatives: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    evidence: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["turnQuote", "sourceQuote", "section", "rationale", "confidence"],
        properties: {
          turnQuote: { type: "string" },
          sourceQuote: { type: "string" },
          section: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    disclaimer: { type: "string" },
  },
} as const;

