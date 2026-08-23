export type CaseGeneratorRoleFields = {
  name: string;
  position: string;
  publicGoal: string;
  interests: string;
  constraints: string;
  hiddenMotives: string;
  leverage: string;
  roleBrief: string;
  openingLine: string;
  typicalObjections: string;
  recommendedPhrases: string;
  forbiddenPhrases: string;
};

export type CaseGeneratorFields = {
  summary: string;
  situation: string;
  conflict: string;
  addressForm: "" | "formal" | "informal";
  startSituation: string;
  stakes: string;
  difficultyReason: string;
  evaluationFocus: string;
  negotiationPairs: string;
  scenarioConditions: string;
  decisionTerms: string;
  authorityLimits: string;
  riskZones: string;
  successOutcome: string;
  expectedNextSteps: string;
  methodologyNotes: string;
  roles: CaseGeneratorRoleFields[];
};

export function emptyCaseGeneratorRole(): CaseGeneratorRoleFields {
  return {
    name: "", position: "", publicGoal: "", interests: "", constraints: "", hiddenMotives: "", leverage: "",
    roleBrief: "", openingLine: "", typicalObjections: "", recommendedPhrases: "", forbiddenPhrases: "",
  };
}

export function emptyCaseGeneratorFields(): CaseGeneratorFields {
  return {
    summary: "", situation: "", conflict: "", addressForm: "", startSituation: "", stakes: "", difficultyReason: "",
    evaluationFocus: "", negotiationPairs: "", scenarioConditions: "", decisionTerms: "", authorityLimits: "",
    riskZones: "", successOutcome: "", expectedNextSteps: "", methodologyNotes: "",
    roles: Array.from({ length: 4 }, emptyCaseGeneratorRole),
  };
}

function add(lines: string[], label: string, value: string) {
  const normalized = value.trim();
  if (normalized) lines.push(`${label}:\n${normalized}`);
}

export function formatCaseGeneratorFields(fields: CaseGeneratorFields, roleCount: number) {
  const lines: string[] = ["СТРУКТУРИРОВАННЫЕ ПОЛЯ КЕЙСА, ЗАПОЛНЕННЫЕ ПОЛЬЗОВАТЕЛЕМ:"];
  add(lines, "Краткое описание", fields.summary);
  add(lines, "Ситуация и контекст", fields.situation);
  add(lines, "Центральный конфликт", fields.conflict);
  if (fields.addressForm) lines.push(`Форма обращения: ${fields.addressForm === "informal" ? "на ты" : "на вы"}`);
  add(lines, "Начальная ситуация", fields.startSituation);
  add(lines, "Ставки (по одной на строке)", fields.stakes);
  add(lines, "Почему кейс сложный", fields.difficultyReason);
  add(lines, "Фокус оценки (по одному на строке)", fields.evaluationFocus);
  add(lines, "Предметы переговоров между ролями", fields.negotiationPairs);
  add(lines, "Обязательные сценарные условия, включая точное число действий или перебиваний", fields.scenarioConditions);
  add(lines, "Условия решения", fields.decisionTerms);
  add(lines, "Границы полномочий", fields.authorityLimits);
  add(lines, "Опасные зоны", fields.riskZones);
  add(lines, "Успешный итог", fields.successOutcome);
  add(lines, "Ожидаемые следующие шаги", fields.expectedNextSteps);
  add(lines, "Методические пояснения", fields.methodologyNotes);

  fields.roles.slice(0, roleCount).forEach((role, index) => {
    const roleLines: string[] = [];
    add(roleLines, "ФИО", role.name);
    add(roleLines, "Должность", role.position);
    add(roleLines, "Открытая цель", role.publicGoal);
    add(roleLines, "Интересы", role.interests);
    add(roleLines, "Ограничения", role.constraints);
    add(roleLines, "Скрытые мотивы", role.hiddenMotives);
    add(roleLines, "Ресурсы влияния", role.leverage);
    add(roleLines, "Задача в разговоре", role.roleBrief);
    add(roleLines, "Стартовая реплика", role.openingLine);
    add(roleLines, "Типовые возражения", role.typicalObjections);
    add(roleLines, "Рекомендуемые формулировки", role.recommendedPhrases);
    add(roleLines, "Запрещённые формулировки", role.forbiddenPhrases);
    if (roleLines.length) lines.push(`РОЛЬ ${index + 1}:\n${roleLines.join("\n")}`);
  });

  return lines.length > 1 ? lines.join("\n\n") : "";
}
