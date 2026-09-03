import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LaborLawRisksSection } from "../src/components/NegotiationReport";
import { negotiationAnalysisSchema } from "../src/lib/analysis-types";
import { laborLawRiskInstructions, oneCAnalysisPriorityInstructions, sanitizeLaborLawRisks } from "../src/lib/labor-law-risks";

const modelRisk = {
  referenceId: "worse-dismissal",
  turnQuote: "Если ты не подпишешь это соглашение, мы уволим тебя по статье.",
  dangerousPhrase: "выдуманное значение модели",
  risk: "выдуманный риск модели",
  articles: "выдуманные статьи",
};

describe("риски по ТК РФ в кейсе 1С", () => {
  it("добавляет в строгую схему отдельный массив рисков", () => {
    expect(negotiationAnalysisSchema.required).toContain("laborLawRisks");
    expect(negotiationAnalysisSchema.properties.laborLawRisks.items.required)
      .toEqual(["referenceId", "turnQuote", "dangerousPhrase", "risk", "articles"]);
  });

  it("просит искать смысловые аналоги только для кейса 1С", () => {
    expect(laborLawRiskInstructions("1c-dismissal")).toContain("явном совпадении по смыслу");
    expect(laborLawRiskInstructions("another-case")).toBe("Поле laborLawRisks верни пустым массивом.");
  });

  it("отдельно приоритизирует методические ошибки и не смешивает их с рисками по ТК РФ", () => {
    const instructions = oneCAnalysisPriorityInstructions("1c-dismissal");
    expect(instructions).toContain("обязательно включи это в risks как методическую ошибку");
    expect(instructions).toContain("не является автоматически риском по ТК РФ");
    expect(oneCAnalysisPriorityInstructions("another-case")).toBe("");
  });

  it("оставляет только дословную реплику руководителя и восстанавливает справочные данные", () => {
    expect(sanitizeLaborLawRisks("1c-dismissal", [modelRisk], [modelRisk.turnQuote])).toEqual([{
      referenceId: "worse-dismissal",
      turnQuote: modelRisk.turnQuote,
      dangerousPhrase: "Если не подпишешь соглашение, уволим хуже",
      risk: "Прямое давление",
      articles: "ст. 78, 80, 81, 237, 394",
    }]);
    expect(sanitizeLaborLawRisks("1c-dismissal", [modelRisk], ["Давайте обсудим условия."])).toEqual([]);
    expect(sanitizeLaborLawRisks("another-case", [modelRisk], [modelRisk.turnQuote])).toEqual([]);
  });

  it("не формирует пустой раздел и показывает найденный риск", () => {
    expect(renderToStaticMarkup(<LaborLawRisksSection items={[]} />)).toBe("");
    const [risk] = sanitizeLaborLawRisks("1c-dismissal", [modelRisk], [modelRisk.turnQuote]);
    const markup = renderToStaticMarkup(<LaborLawRisksSection items={[risk]} />);
    expect(markup).toContain("РИСКИ С ТОЧКИ ЗРЕНИЯ ТК РФ");
    expect(markup).toContain(modelRisk.turnQuote);
    expect(markup).toContain("ст. 78, 80, 81, 237, 394");
  });
});
