import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NegotiationReport from "../src/components/NegotiationReport";
import type { NegotiationAnalysis } from "../src/lib/analysis-types";

const analysis: NegotiationAnalysis = {
  methodologyStatus: "candidate",
  methodologyVersion: "dismissal-1c-v0-candidate",
  overallScore: 60,
  summary: "Разговор завершён.",
  outcome: { winner: "draw", verdict: "Есть ошибки.", reasons: ["Причина 1", "Причина 2"], confidence: 0.8 },
  personalFeedback: "Персональная обратная связь после рисков.",
  scoreBreakdown: [],
  strengths: ["Спокойный тон"],
  risks: ["Руководитель предложил отправить письменное подтверждение договорённостей."],
  laborLawRisks: [{
    referenceId: "worse-dismissal",
    turnQuote: "Если не подпишешь, будет хуже.",
    dangerousPhrase: "Если не подпишешь соглашение, уволим хуже",
    risk: "Прямое давление",
    articles: "ст. 78, 80, 81, 237, 394",
  }],
  antiPatterns: [],
  turningPoints: [],
  stratagems: [],
  alternatives: ["Альтернатива 1", "Альтернатива 2"],
  techniqueReview: [],
  developmentPlan: [],
  evidence: [],
  disclaimer: "Предварительный анализ.",
};

describe("приоритет рисков в отчёте 1С", () => {
  it("показывает выделенные методические и трудовые риски раньше положительной обратной связи", () => {
    const markup = renderToStaticMarkup(
      <NegotiationReport
        analysis={analysis}
        methodologyId="dismissal_1c"
        opponentName="Алексей Морозов"
        reportMeta={{
          occurredAt: "2026-09-03T18:00:00.000Z",
          caseTitle: "1С Увольнение",
          userFullName: "Марина Соколова",
          participantRole: "Руководитель практики 1С",
        }}
      />,
    );

    const priorityIndex = markup.indexOf("ОБРАТИТЕ ВНИМАНИЕ В ПЕРВУЮ ОЧЕРЕДЬ");
    expect(priorityIndex).toBeGreaterThan(-1);
    expect(markup.indexOf("НЕСООТВЕТСТВИЯ МЕТОДОЛОГИИ")).toBeGreaterThan(priorityIndex);
    expect(markup.indexOf("РИСКИ С ТОЧКИ ЗРЕНИЯ ТК РФ")).toBeGreaterThan(priorityIndex);
    expect(markup.indexOf("ПЕРСОНАЛЬНАЯ ОБРАТНАЯ СВЯЗЬ")).toBeGreaterThan(priorityIndex);
    expect(markup.indexOf("ЧТО БЫЛО ХОРОШО")).toBeGreaterThan(priorityIndex);
  });
});
