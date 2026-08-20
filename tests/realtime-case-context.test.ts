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

  it.each([2, 3, 4])("сохраняет ФИО и должности при всех перестановках %i ролей", (roleCount) => {
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
        const instructions = buildRealtimeInstructions({
          negotiationStyle: "collaborative",
          context: negotiationCase.situation,
          userRole: selected.participantRole,
          opponentRole: selected.opponentRole,
        });

        expect(instructions).toContain(`ТВОЯ РОЛЬ: ${roles[opponentIndex].name}, ${roles[opponentIndex].position}.`);
        expect(instructions).toContain(`РОЛЬ УЧАСТНИКА: ${roles[participantIndex].name}, ${roles[participantIndex].position}.`);
      }
    }
  });
});
