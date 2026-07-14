export type DuelParticipantFeedback = {
  name: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  techniqueReview: Array<{
    technique: string;
    status: "successful" | "partial" | "missed";
    turnQuote: string;
    sourceQuote: string;
    section: string;
    explanation: string;
  }>;
  recommendations: Array<{
    skill: string;
    why: string;
    practice: string;
  }>;
};

export type DuelFileAnalysis = {
  methodologyStatus: "candidate" | "verified";
  methodologyVersion: string;
  summary: string;
  outcome: {
    winner: "participant1" | "participant2" | "draw";
    verdict: string;
    reasons: string[];
    confidence: number;
  };
  turningPoints: Array<{ moment: string; assessment: string }>;
  participant1: DuelParticipantFeedback;
  participant2: DuelParticipantFeedback;
  disclaimer: string;
};

const participantSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "score", "summary", "strengths", "improvements", "techniqueReview", "recommendations"],
  properties: {
    name: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    improvements: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    techniqueReview: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["technique", "status", "turnQuote", "sourceQuote", "section", "explanation"],
        properties: {
          technique: { type: "string" },
          status: { type: "string", enum: ["successful", "partial", "missed"] },
          turnQuote: { type: "string" },
          sourceQuote: { type: "string" },
          section: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      minItems: 2,
      maxItems: 4,
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
  },
} as const;

export const duelFileAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["methodologyStatus", "methodologyVersion", "summary", "outcome", "turningPoints", "participant1", "participant2", "disclaimer"],
  properties: {
    methodologyStatus: { type: "string", enum: ["candidate", "verified"] },
    methodologyVersion: { type: "string" },
    summary: { type: "string" },
    outcome: {
      type: "object",
      additionalProperties: false,
      required: ["winner", "verdict", "reasons", "confidence"],
      properties: {
        winner: { type: "string", enum: ["participant1", "participant2", "draw"] },
        verdict: { type: "string" },
        reasons: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    turningPoints: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["moment", "assessment"],
        properties: { moment: { type: "string" }, assessment: { type: "string" } },
      },
    },
    participant1: participantSchema,
    participant2: participantSchema,
    disclaimer: { type: "string" },
  },
} as const;
