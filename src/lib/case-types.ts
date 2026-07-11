export type CaseRole = {
  name: string;
  position: string;
  publicGoal: string;
  interests: string[];
  constraints: string[];
  hiddenMotives: string[];
  leverage: string[];
};

export type CanonicalCase = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  situation: string;
  conflict: string;
  userRole: CaseRole;
  opponentRole: CaseRole;
  stakes: string[];
  startSituation: string;
  difficultyReason: string;
  evaluationFocus: string[];
  methodologyBasis: MethodologyBasis[];
  origin: "seed" | "quick_upload" | "builder";
};

export type MethodologyBasis = {
  atomId: string;
  title: string;
  application: string;
};

export type GeneratedCaseVariant = Omit<CanonicalCase, "id" | "slug" | "origin">;

export type CaseWorkspaceView = {
  id: string;
  title: string;
  notes: string;
  status: "draft" | "analyzed" | "approved";
  materials: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  variants: Array<GeneratedCaseVariant & { id: string; approvedAt: string | null }>;
};

export function mapCaseRow(row: Record<string, unknown>): CanonicalCase {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    situation: String(row.situation),
    conflict: String(row.conflict),
    userRole: row.user_role as CaseRole,
    opponentRole: row.opponent_role as CaseRole,
    stakes: (row.stakes || []) as string[],
    startSituation: String(row.start_situation),
    difficultyReason: String(row.difficulty_reason),
    evaluationFocus: (row.evaluation_focus || []) as string[],
    methodologyBasis: (row.methodology_basis || []) as MethodologyBasis[],
    origin: row.origin as CanonicalCase["origin"],
  };
}

const stringArray = {
  type: "array",
  items: { type: "string" },
  minItems: 1,
  maxItems: 8,
} as const;

const roleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    position: { type: "string" },
    publicGoal: { type: "string" },
    interests: stringArray,
    constraints: stringArray,
    hiddenMotives: { ...stringArray, minItems: 0 },
    leverage: stringArray,
  },
  required: ["name", "position", "publicGoal", "interests", "constraints", "hiddenMotives", "leverage"],
} as const;

export function createCaseVariantsSchema(atomIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      variants: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            situation: { type: "string" },
            conflict: { type: "string" },
            userRole: roleSchema,
            opponentRole: roleSchema,
            stakes: stringArray,
            startSituation: { type: "string" },
            difficultyReason: { type: "string" },
            evaluationFocus: stringArray,
            methodologyBasis: {
              type: "array",
              minItems: atomIds.length ? 1 : 0,
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  atomId: atomIds.length ? { type: "string", enum: atomIds } : { type: "string", enum: [""] },
                  title: { type: "string" },
                  application: { type: "string" },
                },
                required: ["atomId", "title", "application"],
              },
            },
          },
          required: [
            "title", "summary", "situation", "conflict", "userRole", "opponentRole",
            "stakes", "startSituation", "difficultyReason", "evaluationFocus", "methodologyBasis",
          ],
        },
      },
    },
    required: ["variants"],
  } as const;
}
