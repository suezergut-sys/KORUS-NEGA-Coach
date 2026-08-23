export const METHODOLOGIES = [
  {
    id: "tarasov",
    name: "Методология Владимира Тарасова",
    shortName: "Тарасов",
    sourceCode: "SRC-001",
    author: "Владимир Тарасов",
    candidateVersion: "tarasov-v0-candidate",
    releaseVersion: "tarasov-v1",
    visibility: "public",
  },
  {
    id: "harvard",
    name: "Гарвардский метод переговоров",
    shortName: "Гарвардский метод",
    sourceCode: "SRC-002",
    author: "Роджер Фишер, Уильям Юри и Брюс Паттон",
    candidateVersion: "harvard-v0-candidate",
    releaseVersion: "harvard-v1",
    visibility: "public",
  },
  {
    id: "conflicts",
    name: "Работа с конфликтами",
    shortName: "Работа с конфликтами",
    sourceCode: "SRC-003",
    author: "Ирина Матвеева",
    candidateVersion: "conflicts-v0-candidate",
    releaseVersion: "conflicts-v1",
    visibility: "public",
  },
  {
    id: "dismissal_1c",
    name: "1С: разговор об увольнении по соглашению сторон",
    shortName: "1С: увольнение",
    sourceCode: "SRC-004",
    author: "Корпоративная методология 1С",
    candidateVersion: "dismissal-1c-v0-candidate",
    releaseVersion: "dismissal-1c-v1",
    visibility: "case",
  },
] as const;

export type MethodologyId = (typeof METHODOLOGIES)[number]["id"];
export type Methodology = (typeof METHODOLOGIES)[number];

export const DEFAULT_METHODOLOGY_ID: MethodologyId = "tarasov";

export function isMethodologyId(value: unknown): value is MethodologyId {
  return typeof value === "string" && METHODOLOGIES.some((item) => item.id === value && item.visibility === "public");
}

export function isRegisteredMethodologyId(value: unknown): value is MethodologyId {
  return typeof value === "string" && METHODOLOGIES.some((item) => item.id === value);
}

export function getMethodology(value: unknown): Methodology {
  return METHODOLOGIES.find((item) => item.id === value && item.visibility === "public") || METHODOLOGIES[0];
}

export function getRegisteredMethodology(value: unknown): Methodology {
  return METHODOLOGIES.find((item) => item.id === value) || METHODOLOGIES[0];
}

export function methodologyOptions(includeIds: readonly MethodologyId[] = []) {
  return METHODOLOGIES.filter((item) => item.visibility === "public" || includeIds.includes(item.id)).map(({ id, name }) => ({ id, name }));
}

export function getAdminMethodology(value: unknown): Methodology {
  return METHODOLOGIES.find((item) => item.id === value) || METHODOLOGIES[0];
}

export function adminMethodologyOptions() {
  return METHODOLOGIES.map(({ id, name }) => ({ id, name }));
}
