import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { negotiationAnalysisSchema } from "../src/lib/analysis-types";
import { TurningPointsSection } from "../src/components/NegotiationReport";

describe("подсказки в поворотных моментах", () => {
  it("требует от модели влияние момента и улучшенный ход", () => {
    const itemSchema = negotiationAnalysisSchema.properties.turningPoints.items;

    expect(itemSchema.required).toEqual(["moment", "assessment", "impact", "betterMove"]);
    expect(itemSchema.properties.impact.enum).toEqual(["improved", "worsened", "mixed"]);
    expect(itemSchema.properties.betterMove.minLength).toBe(1);
  });

  it("показывает совет только после ухудшения позиции пользователя", () => {
    const markup = renderToStaticMarkup(<TurningPointsSection items={[
      { moment: "Давление без вопроса", assessment: "Позиция ослабла.", impact: "worsened", betterMove: "Уточнить интерес: «Что для вас критично в сроке?»" },
      { moment: "Уточнение интересов", assessment: "Позиция усилилась.", impact: "improved", betterMove: "Продолжить уточнение." },
      { moment: "Старый отчёт", assessment: "Оценка сохранена." },
    ]} />);

    expect(markup).toContain("Как можно было лучше");
    expect(markup).toContain("Что для вас критично в сроке?");
    expect(markup).not.toContain("Продолжить уточнение.");
  });
});
