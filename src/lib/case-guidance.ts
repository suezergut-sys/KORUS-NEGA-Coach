import type { CanonicalCase, CaseRole } from "@/lib/case-types";

function bullets(values?: string[]) {
  return values?.length ? values.map((value) => `- ${value}`).join("\n") : "- не заданы";
}

function roleGuidance(label: string, role: CaseRole) {
  return `${label}: ${role.name}, ${role.position}
Подробная задача: ${role.roleBrief || "не задана"}
Стартовая реплика: ${role.openingLine || "не задана"}
Типовые возражения:
${bullets(role.typicalObjections)}
Рекомендуемые формулировки:
${bullets(role.recommendedPhrases)}
Запрещённые формулировки:
${bullets(role.forbiddenPhrases)}`;
}

export function formatCaseGuidance(
  negotiationCase: CanonicalCase,
  participantRole: CaseRole,
  opponentRole: CaseRole,
) {
  return `ДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ КЕЙСА
${roleGuidance("Участник", participantRole)}

${roleGuidance("Оппонент", opponentRole)}

Сценарные условия:
${bullets(negotiationCase.scenarioConditions)}
Условия решения:
${bullets(negotiationCase.decisionTerms)}
Границы полномочий:
${bullets(negotiationCase.authorityLimits)}
Опасные зоны:
${bullets(negotiationCase.riskZones)}
Успешный итог: ${negotiationCase.successOutcome || "не задан"}
Ожидаемые следующие шаги:
${bullets(negotiationCase.expectedNextSteps)}
Методические пояснения: ${negotiationCase.methodologyNotes || "не заданы"}`;
}
