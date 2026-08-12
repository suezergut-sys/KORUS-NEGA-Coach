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
    expect(employeeSession.instructions).not.toContain("гарантированный объём закупки");
    expect(procurementSession.instructions).toContain("Поставщик обсуждает годовой контракт на продукцию.");
    expect(firstTurnEvents.at(-1)).toEqual({
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
    expect(firstTurnEvents.at(-1)).not.toHaveProperty("response.instructions");
  });
});
