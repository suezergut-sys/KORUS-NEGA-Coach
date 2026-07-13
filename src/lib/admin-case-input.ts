import { isCanonicalPersonName, normalizeCaseRole, type CaseRole, type MethodologyBasis } from "./case-types";

const STATUSES = new Set(["draft", "published", "archived"]);
const ORIGINS = new Set(["seed", "quick_upload", "builder"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown, maxItems = 20) {
  return Array.isArray(value) ? value.map((item) => text(item, 1000)).filter(Boolean).slice(0, maxItems) : [];
}

function role(value: unknown): CaseRole {
  const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const parsed = normalizeCaseRole({
    name: text(item.name, 160),
    position: text(item.position, 240),
    voiceGender: item.voiceGender === "female" ? "female" : "male",
    publicGoal: text(item.publicGoal, 3000),
    interests: list(item.interests),
    constraints: list(item.constraints),
    hiddenMotives: list(item.hiddenMotives),
    leverage: list(item.leverage),
  });
  if (!isCanonicalPersonName(parsed.name) || !parsed.position || !parsed.publicGoal) {
    throw new Error("Для каждой роли нужны имя и фамилия, должность и публичная цель.");
  }
  return parsed;
}

function methodology(value: unknown): MethodologyBasis[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((entry) => {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    return { atomId: text(item.atomId, 160), title: text(item.title, 300), application: text(item.application, 2000) };
  }).filter((item) => item.title && item.application);
}

export function parseAdminCaseInput(value: unknown) {
  const body = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const title = text(body.title, 240);
  const summary = text(body.summary, 3000);
  const situation = text(body.situation, 12000);
  const conflict = text(body.conflict, 6000);
  const startSituation = text(body.startSituation, 6000);
  const difficultyReason = text(body.difficultyReason, 6000);
  if (!title || !summary || !situation || !conflict || !startSituation || !difficultyReason) {
    throw new Error("Заполните все основные параметры кейса.");
  }
  const status = text(body.status, 20);
  const origin = text(body.origin, 30);
  if (!STATUSES.has(status) || !ORIGINS.has(origin)) throw new Error("Некорректный статус или источник кейса.");
  const userRole = role(body.userRole);
  const opponentRole = role(body.opponentRole);
  const additionalRoles = Array.isArray(body.additionalRoles) ? body.additionalRoles.slice(0, 2).map(role) : [];
  const names = [userRole, opponentRole, ...additionalRoles].map((item) => item.name.toLocaleLowerCase("ru"));
  if (new Set(names).size !== names.length) throw new Error("У ролей должны быть разные имена.");
  return {
    title,
    summary,
    situation,
    conflict,
    userRole,
    opponentRole,
    additionalRoles,
    stakes: list(body.stakes),
    startSituation,
    difficultyReason,
    evaluationFocus: list(body.evaluationFocus),
    methodologyBasis: methodology(body.methodologyBasis),
    status,
    origin,
    createdBy: text(body.createdBy, 160) || "Администратор",
  };
}
