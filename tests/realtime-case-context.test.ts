import { describe, expect, it } from "vitest";
import { buildRealtimeInstructions } from "@/lib/prompt";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { buildRealtimeResponseEvents } from "@/lib/realtime-webrtc";

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
});
