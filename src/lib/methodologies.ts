export const METHODOLOGIES = [
  {
    id: "tarasov",
    name: "Методология Владимира Тарасова",
    shortName: "Тарасов",
    sourceCode: "SRC-001",
    author: "Владимир Тарасов",
    candidateVersion: "tarasov-v0-candidate",
    releaseVersion: "tarasov-v1",
  },
  {
    id: "harvard",
    name: "Гарвардский метод переговоров",
    shortName: "Гарвардский метод",
    sourceCode: "SRC-002",
    author: "Роджер Фишер, Уильям Юри и Брюс Паттон",
    candidateVersion: "harvard-v0-candidate",
    releaseVersion: "harvard-v1",
  },
] as const;

export type MethodologyId = (typeof METHODOLOGIES)[number]["id"];
export type Methodology = (typeof METHODOLOGIES)[number];

export const DEFAULT_METHODOLOGY_ID: MethodologyId = "tarasov";

export function getMethodology(value: unknown): Methodology {
  return METHODOLOGIES.find((item) => item.id === value) || METHODOLOGIES[0];
}

export function methodologyOptions() {
  return METHODOLOGIES.map(({ id, name }) => ({ id, name }));
}
