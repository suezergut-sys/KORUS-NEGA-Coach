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
  outcome: {
    winner: "user" | "opponent" | "draw";
    verdict: string;
    reasons: string[];
  };
  personalFeedback: string;
  scoreBreakdown: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    explanation: string;
  }>;
  strengths: string[];
  risks: string[];
  turningPoints: Array<{ moment: string; assessment: string }>;
  stratagems: Array<{
    name: string;
    status: "observed" | "possible" | "missed";
    explanation: string;
  }>;
  alternatives: string[];
  techniqueReview: Array<{
    technique: string;
    status: "successful" | "partial" | "missed";
    turnQuote: string;
    sourceQuote: string;
    section: string;
    methodologyAtomId: string;
    explanation: string;
  }>;
  developmentPlan: Array<{
    skill: string;
    why: string;
    practice: string;
  }>;
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
    "outcome",
    "personalFeedback",
    "scoreBreakdown",
    "strengths",
    "risks",
    "turningPoints",
    "stratagems",
    "alternatives",
    "techniqueReview",
    "developmentPlan",
    "evidence",
    "disclaimer",
  ],
  properties: {
    methodologyStatus: { type: "string", enum: ["candidate", "verified"] },
    methodologyVersion: { type: "string" },
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    outcome: {
      type: "object",
      additionalProperties: false,
      required: ["winner", "verdict", "reasons"],
      properties: {
        winner: { type: "string", enum: ["user", "opponent", "draw"] },
        verdict: { type: "string" },
        reasons: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
      },
    },
    personalFeedback: { type: "string" },
    scoreBreakdown: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterion", "score", "maxScore", "explanation"],
        properties: {
          criterion: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          maxScore: { type: "integer", minimum: 1, maximum: 100 },
          explanation: { type: "string" },
        },
      },
    },
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
    techniqueReview: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["technique", "status", "turnQuote", "sourceQuote", "section", "methodologyAtomId", "explanation"],
        properties: {
          technique: { type: "string" },
          status: { type: "string", enum: ["successful", "partial", "missed"] },
          turnQuote: { type: "string" },
          sourceQuote: { type: "string" },
          section: { type: "string" },
          methodologyAtomId: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
    developmentPlan: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["skill", "why", "practice"],
        properties: {
          skill: { type: "string" },
          why: { type: "string" },
          practice: { type: "string" },
        },
      },
    },
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

export function createNegotiationAnalysisSchema(atomIds: string[]) {
  const schema = structuredClone(negotiationAnalysisSchema) as unknown as {
    properties: {
      techniqueReview: {
        items: { properties: { methodologyAtomId: Record<string, unknown> } };
      };
    };
  };
  schema.properties.techniqueReview.items.properties.methodologyAtomId = {
    type: "string",
    enum: atomIds.length ? atomIds : [""],
  };
  return schema;
}
