export const METHODOLOGY_ATOM_KINDS = [
  "principle",
  "case_rule",
  "stratagem",
  "anti_pattern",
  "example",
  "evaluation_criterion",
] as const;

export type MethodologyAtomKind = (typeof METHODOLOGY_ATOM_KINDS)[number];

export const METHODOLOGY_ATOM_LABELS: Record<MethodologyAtomKind, string> = {
  principle: "Принцип",
  case_rule: "Правило кейса",
  stratagem: "Тактический приём",
  anti_pattern: "Антиприём",
  example: "Пример",
  evaluation_criterion: "Критерий оценки",
};

export const METHODOLOGY_ATOM_DESCRIPTIONS: ReadonlyArray<{ kind: MethodologyAtomKind; description: string }> = [
  {
    kind: "principle",
    description: "Базовая идея или закономерность, на которой строится эффективное поведение в переговорах. Объясняет, почему определённый подход работает и чем следует руководствоваться в разных ситуациях.",
  },
  {
    kind: "case_rule",
    description: "Конкретное условие учебного кейса, которое участник должен учитывать при принятии решений. Определяет границы сценария: что разрешено, запрещено или обязательно именно в этом упражнении.",
  },
  {
    kind: "stratagem",
    description: "Тактика, позволяющая повлиять на ход переговоров и приблизиться к своей цели. Описывает, как именно можно действовать в конкретной ситуации.",
  },
  {
    kind: "anti_pattern",
    description: "Манипулятивная или разрушительная тактика, которую не рекомендуется использовать. Если участник применяет её, это считается подтверждённым риском и снижает оценку переговоров.",
  },
  {
    kind: "example",
    description: "Наглядная иллюстрация применения принципа, правила или тактического приёма. Показывает возможную реплику, действие или развитие ситуации, но не является единственно правильным вариантом.",
  },
  {
    kind: "evaluation_criterion",
    description: "Измеримый признак, по которому определяется качество действий участника. Объясняет, что именно оценивается и как отличить сильное решение от слабого.",
  },
];

export function methodologyAtomLabel(value: string) {
  return METHODOLOGY_ATOM_LABELS[value as MethodologyAtomKind] || value;
}
