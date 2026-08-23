import { describe, expect, it } from "vitest";
import { buildRealtimeInstructions } from "@/lib/prompt";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { buildRealtimeResponseEvents } from "@/lib/realtime-webrtc";
import { allNegotiationPairs } from "@/lib/case-negotiation-pairs";
import { selectCaseRoles } from "@/lib/case-role-selection";
import { DEFAULT_CASE } from "@/lib/default-case";

function sessionFor(context: string, startSituation: string) {
  const instructions = buildRealtimeInstructions({
    role: "Оппонент",
    negotiationStyle: "collaborative",
    context,
    startSituation,
  });

  return buildRealtimeSessionConfig({
    instructions,
    negotiationStyle: "collaborative",
    voice: "marin",
  });
}

const managerRole = {
  name: "Дмитрий Ковалёв",
  position: "Руководитель практики аналитики",
  publicGoal: "Корректно завершить трудовые отношения",
  interests: ["Соблюсти бюджет"],
  constraints: ["Действовать вместе с HRBP"],
};

const employeeRole = {
  name: "Леонид Башкатов",
  position: "Старший бизнес-аналитик",
  publicGoal: "Сохранить работу или получить справедливую компенсацию",
  interests: ["Стабильная занятость"],
  constraints: ["Нет коммерческой загрузки"],
  hiddenMotives: ["Не потерять доход"],
  leverage: ["Сильная репутация"],
};

describe("контекст выбранного кейса в Realtime", () => {
  it("оставляет контекст конкретного кейса в инструкциях сессии для первой реплики", () => {
    const employeeSession = sessionFor(
      "Сотрудник получил оффер от внешнего заказчика.",
      "Обсудить удержание сотрудника после тяжёлого проекта.",
    );
    const procurementSession = sessionFor(
      "Поставщик обсуждает годовой контракт на продукцию.",
      "Согласовать гарантированный объём закупки.",
    );
    const firstTurnEvents = buildRealtimeResponseEvents("Начни переговоры первым.");

    expect(employeeSession.instructions).toContain("Сотрудник получил оффер от внешнего заказчика.");
    expect(employeeSession.instructions).toContain("Произноси только прямую речь персонажа");
    expect(employeeSession.instructions).not.toContain("гарантированный объём закупки");
    expect(procurementSession.instructions).toContain("Поставщик обсуждает годовой контракт на продукцию.");
    expect(firstTurnEvents.at(-1)).toEqual({
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
    expect(firstTurnEvents.at(-1)).not.toHaveProperty("response.instructions");
  });

  it("явно закрепляет сотрудника за ИИ, а руководителя — за участником", () => {
    const instructions = buildRealtimeInstructions({
      role: `${employeeRole.name}, ${employeeRole.position}`,
      negotiationStyle: "collaborative",
      addressForm: "informal",
      context: "Руководитель и HRBP должны обсудить расставание с сотрудником.",
      userRole: managerRole,
      opponentRole: employeeRole,
    });

    expect(instructions).toContain("ТВОЯ РОЛЬ: Леонид Башкатов, Старший бизнес-аналитик.");
    expect(instructions).toContain("РОЛЬ УЧАСТНИКА: Дмитрий Ковалёв, Руководитель практики аналитики.");
    expect(instructions).toContain("Не путай стороны");
    expect(instructions).toContain("Не спрашивай участника, хочет ли он сохранить твою работу");
    expect(instructions).toContain("описание ситуации сформулировано с точки зрения руководителя");
  });

  it("передаёт точные реплики, запреты и границы полномочий в контракт кейса", () => {
    const instructions = buildRealtimeInstructions({
      negotiationStyle: "collaborative",
      firstSpeaker: "opponent",
      title: "Увольнение",
      summary: "Первый разговор руководителя и сотрудника.",
      context: "Первый разговор об увольнении.",
      difficultyReason: "Решение принято, но сотрудник не виноват.",
      evaluationFocus: ["Выдержать возражения"],
      methodologyBasis: [{ title: "Не давить", application: "Не требовать немедленного согласия" }],
      userRole: {
        ...managerRole,
        roleBrief: "Сообщить решение прямо.",
        recommendedPhrases: ["Мы приняли решение."],
        forbiddenPhrases: ["Если не подпишешь, будет хуже."],
      },
      opponentRole: {
        ...employeeRole,
        openingLine: "Это вы не нашли мне проект.",
        typicalObjections: ["Почему именно я?"],
      },
      scenarioConditions: ["Высказать не менее трёх разных содержательных возражений против увольнения."],
      decisionTerms: ["Один оклад"],
      authorityLimits: ["Нельзя обещать больше одного оклада"],
      riskZones: ["Понуждение"],
      successOutcome: "Сотрудник понял причину и следующий шаг.",
      expectedNextSteps: ["HR-сопровождение"],
    });

    expect(instructions).toContain("Мы приняли решение.");
    expect(instructions).toContain("Если не подпишешь, будет хуже.");
    expect(instructions).toContain("Это вы не нашли мне проект.");
    expect(instructions).toContain("Почему именно я?");
    expect(instructions).toContain("КРАТКОЕ ОПИСАНИЕ: Первый разговор руководителя и сотрудника.");
    expect(instructions).toContain("ПОЧЕМУ КЕЙС СЛОЖНЫЙ: Решение принято, но сотрудник не виноват.");
    expect(instructions).toContain("ФОКУС ОЦЕНКИ: Выдержать возражения");
    expect(instructions).toContain("Не давить: Не требовать немедленного согласия");
    expect(instructions).toContain("ОБЯЗАТЕЛЬНЫЕ СЦЕНАРНЫЕ УСЛОВИЯ");
    expect(instructions).toContain("не менее трёх разных содержательных возражений");
    expect(instructions).toContain("Молча отслеживай их выполнение по истории разговора");
    expect(instructions).toContain("единый внутренний журнал количественных сценарных условий");
    expect(instructions).toContain("намеренные перебивания");
    expect(instructions).toContain("у меня сейчас нет этой информации");
    expect(instructions).toContain("Никогда не упоминай «кейс», «исходные данные»");
    expect(instructions).not.toContain("Если конкретики нет, описывай только пробел в исходных данных");
    expect(instructions).toContain("Нельзя обещать больше одного оклада");
    expect(instructions).toContain("критерии тренировки, а не твои реплики");
  });

  it("берёт личность ИИ только из выбранного объекта оппонента", () => {
    const instructions = buildRealtimeInstructions({
      role: "Ошибочная Дублирующая Роль, не должна использоваться",
      negotiationStyle: "collaborative",
      context: "Проверка единственного источника роли.",
      userRole: managerRole,
      opponentRole: employeeRole,
    });

    expect(instructions).toContain("ТВОЯ РОЛЬ: Леонид Башкатов, Старший бизнес-аналитик.");
    expect(instructions).not.toContain("Ошибочная Дублирующая Роль");
  });

  it.each([2, 3, 4])("сохраняет роли и все стартовые настройки при всех перестановках %i ролей", (roleCount) => {
    const roles = [
      { ...DEFAULT_CASE.userRole, name: "Анна Соколова", position: "Роль руководителя" },
      { ...DEFAULT_CASE.opponentRole, name: "Борис Воронцов", position: "Роль сотрудника" },
      { ...DEFAULT_CASE.opponentRole, name: "Вера Орлова", position: "Роль HRBP" },
      { ...DEFAULT_CASE.opponentRole, name: "Глеб Романов", position: "Роль заказчика" },
    ].slice(0, roleCount);
    const negotiationCase = {
      ...DEFAULT_CASE,
      userRole: roles[0],
      opponentRole: roles[1],
      additionalRoles: roles.slice(2),
      negotiationPairs: allNegotiationPairs(roleCount),
    };

    for (let participantIndex = 0; participantIndex < roleCount; participantIndex += 1) {
      for (let opponentIndex = 0; opponentIndex < roleCount; opponentIndex += 1) {
        if (participantIndex === opponentIndex) continue;
        const selected = selectCaseRoles(negotiationCase, participantIndex, opponentIndex);
        for (const firstSpeaker of ["participant", "opponent"] as const) {
          for (const negotiationStyle of ["collaborative", "hard"] as const) {
            for (const addressForm of ["informal", "formal"] as const) {
              const instructions = buildRealtimeInstructions({
                negotiationStyle,
                firstSpeaker,
                addressForm,
                context: negotiationCase.situation,
                userRole: selected.participantRole,
                opponentRole: selected.opponentRole,
              });

              expect(instructions).toContain(`ТВОЯ РОЛЬ: ${roles[opponentIndex].name}, ${roles[opponentIndex].position}.`);
              expect(instructions).toContain(`РОЛЬ УЧАСТНИКА: ${roles[participantIndex].name}, ${roles[participantIndex].position}.`);
              expect(instructions).toContain(`AI-ОППОНЕНТ: ${roles[opponentIndex].name}, ${roles[opponentIndex].position}.`);
              expect(instructions).toContain(`УЧАСТНИК-ЧЕЛОВЕК: ${roles[participantIndex].name}, ${roles[participantIndex].position}.`);
              expect(instructions).toContain(firstSpeaker === "participant" ? "ПЕРВЫМ ГОВОРИТ УЧАСТНИК-ЧЕЛОВЕК" : "ПЕРВЫМ ГОВОРИТ AI-ОППОНЕНТ");
              expect(instructions).toContain(negotiationStyle === "hard" ? "СТИЛЬ AI-ОППОНЕНТА: ЖЁСТКИЙ" : "СТИЛЬ AI-ОППОНЕНТА: СОТРУДНИЧЕСТВО");
              expect(instructions).toContain(addressForm === "informal" ? "ФОРМА ОБРАЩЕНИЯ: НА «ТЫ»" : "ФОРМА ОБРАЩЕНИЯ: НА «ВЫ»");
            }
          }
        }
      }
    }
  });
});
