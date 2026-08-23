import { normalizeNegotiationPairs } from "@/lib/case-negotiation-pairs";
import type { MethodologyId } from "@/lib/methodologies";

export type CaseRole = {
  name: string;
  position: string;
  voiceGender: "female" | "male";
  publicGoal: string;
  interests: string[];
  constraints: string[];
  hiddenMotives: string[];
  leverage: string[];
  roleBrief?: string;
  openingLine?: string;
  typicalObjections?: string[];
  recommendedPhrases?: string[];
  forbiddenPhrases?: string[];
};

export type NegotiationPair = {
  roleAIndex: number;
  roleBIndex: number;
  reason: string;
};

export type AddressForm = "formal" | "informal";

export function normalizeAddressForm(value: unknown): AddressForm {
  return value === "informal" ? "informal" : "formal";
}

export type CanonicalCase = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  situation: string;
  conflict: string;
  addressForm: AddressForm;
  userRole: CaseRole;
  opponentRole: CaseRole;
  additionalRoles: CaseRole[];
  negotiationPairs: NegotiationPair[];
  stakes: string[];
  startSituation: string;
  difficultyReason: string;
  evaluationFocus: string[];
  methodologyBasis: MethodologyBasis[];
  decisionTerms?: string[];
  authorityLimits?: string[];
  riskZones?: string[];
  successOutcome?: string;
  expectedNextSteps?: string[];
  methodologyNotes?: string;
  requiredMethodologyId?: MethodologyId | null;
  departmentId?: string | null;
  origin: "seed" | "quick_upload" | "builder";
  visibility: "public" | "private" | "department";
};

export type MethodologyBasis = {
  atomId: string;
  title: string;
  application: string;
};

export type GeneratedCaseVariant = Omit<CanonicalCase, "id" | "slug" | "origin" | "visibility">;

const NAME_PART = /^\p{Lu}[\p{Ll}\p{M}]*(?:[-'’ʼ]\p{Lu}[\p{Ll}\p{M}]*)*$/u;

export function normalizePersonName(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function isCanonicalPersonName(value: string) {
  const parts = normalizePersonName(value).split(" ");
  return parts.length >= 2 && parts.length <= 3 && parts.every((part) => NAME_PART.test(part));
}

export function normalizeCaseRole(role: CaseRole): CaseRole {
  return {
    ...role,
    name: normalizePersonName(role.name),
    position: role.position.normalize("NFC").trim(),
    roleBrief: String(role.roleBrief || "").trim(),
    openingLine: String(role.openingLine || "").trim(),
    typicalObjections: role.typicalObjections || [],
    recommendedPhrases: role.recommendedPhrases || [],
    forbiddenPhrases: role.forbiddenPhrases || [],
  };
}

export function toPublicCase(item: CanonicalCase): CanonicalCase {
  const publicRole = (role: CaseRole): CaseRole => ({ ...role, hiddenMotives: [] });
  return {
    ...item,
    userRole: publicRole(item.userRole),
    opponentRole: publicRole(item.opponentRole),
    additionalRoles: item.additionalRoles.map(publicRole),
  };
}

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
  const additionalRoles = (row.additional_roles || []) as CaseRole[];
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    situation: String(row.situation),
    conflict: String(row.conflict),
    addressForm: normalizeAddressForm(row.address_form),
    userRole: row.user_role as CaseRole,
    opponentRole: row.opponent_role as CaseRole,
    additionalRoles,
    negotiationPairs: normalizeNegotiationPairs(row.negotiation_pairs, 2 + additionalRoles.length),
    stakes: (row.stakes || []) as string[],
    startSituation: String(row.start_situation),
    difficultyReason: String(row.difficulty_reason),
    evaluationFocus: (row.evaluation_focus || []) as string[],
    methodologyBasis: (row.methodology_basis || []) as MethodologyBasis[],
    decisionTerms: (row.decision_terms || []) as string[],
    authorityLimits: (row.authority_limits || []) as string[],
    riskZones: (row.risk_zones || []) as string[],
    successOutcome: String(row.success_outcome || ""),
    expectedNextSteps: (row.expected_next_steps || []) as string[],
    methodologyNotes: String(row.methodology_notes || ""),
    requiredMethodologyId: (row.required_methodology_id || null) as MethodologyId | null,
    departmentId: row.department_id ? String(row.department_id) : null,
    origin: row.origin as CanonicalCase["origin"],
    visibility: row.visibility === "private" || row.visibility === "department" ? row.visibility : "public",
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
    name: {
      type: "string",
      minLength: 3,
      description: "Полное личное имя участника: имя и фамилия, при необходимости отчество. Должность хранится отдельно в position.",
    },
    position: { type: "string" },
    voiceGender: { type: "string", enum: ["female", "male"], description: "Пол персонажа для автоматического выбора голоса ИИ-оппонента." },
    publicGoal: { type: "string" },
    interests: stringArray,
    constraints: stringArray,
    hiddenMotives: { ...stringArray, minItems: 0 },
    leverage: stringArray,
    roleBrief: { type: "string" },
    openingLine: { type: "string" },
    typicalObjections: { ...stringArray, minItems: 0 },
    recommendedPhrases: { ...stringArray, minItems: 0 },
    forbiddenPhrases: { ...stringArray, minItems: 0 },
  },
  required: [
    "name", "position", "voiceGender", "publicGoal", "interests", "constraints", "hiddenMotives", "leverage",
    "roleBrief", "openingLine", "typicalObjections", "recommendedPhrases", "forbiddenPhrases",
  ],
} as const;

const negotiationPairSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    roleAIndex: { type: "integer", minimum: 0, maximum: 3 },
    roleBIndex: { type: "integer", minimum: 0, maximum: 3 },
    reason: { type: "string", minLength: 10, description: "Конкретный предмет переговоров и несовместимые интересы этой пары ролей." },
  },
  required: ["roleAIndex", "roleBIndex", "reason"],
} as const;

export function createCaseVariantsSchema(atomIds: string[], variantCount = 2, roleCount?: 2 | 3 | 4) {
  const additionalRoleCount = roleCount === undefined ? undefined : roleCount - 2;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      variants: {
        type: "array",
        minItems: variantCount,
        maxItems: variantCount,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            situation: { type: "string" },
            conflict: { type: "string" },
            addressForm: {
              type: "string",
              enum: ["formal", "informal"],
              description: "Форма обращения между участниками: informal — общение на «ты», formal — общение на «вы». Если материалы или пользователь не задают внутреннюю культуру явно, выбирай formal.",
            },
            userRole: roleSchema,
            opponentRole: roleSchema,
            additionalRoles: {
              type: "array",
              minItems: additionalRoleCount ?? 0,
              maxItems: additionalRoleCount ?? 2,
              items: roleSchema,
            },
            negotiationPairs: {
              type: "array",
              minItems: roleCount ? roleCount - 1 : 1,
              maxItems: roleCount ? roleCount * (roleCount - 1) / 2 : 6,
              items: negotiationPairSchema,
              description: "Только пары ролей с прямым конфликтом и самостоятельным предметом переговоров. Индексы соответствуют порядку userRole, opponentRole, additionalRoles.",
            },
            stakes: stringArray,
            startSituation: { type: "string" },
            difficultyReason: { type: "string" },
            evaluationFocus: stringArray,
            decisionTerms: { ...stringArray, minItems: 0 },
            authorityLimits: { ...stringArray, minItems: 0 },
            riskZones: { ...stringArray, minItems: 0 },
            successOutcome: { type: "string" },
            expectedNextSteps: { ...stringArray, minItems: 0 },
            methodologyNotes: { type: "string" },
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
            "title", "summary", "situation", "conflict", "addressForm", "userRole", "opponentRole",
            "additionalRoles", "negotiationPairs", "stakes", "startSituation", "difficultyReason", "evaluationFocus", "methodologyBasis",
            "decisionTerms", "authorityLimits", "riskZones", "successOutcome", "expectedNextSteps", "methodologyNotes",
          ],
        },
      },
    },
    required: ["variants"],
  } as const;
}
