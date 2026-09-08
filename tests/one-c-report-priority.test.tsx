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
  scoreBreakdown: [
    { id: "structure", criterion: "Переговорная структура", score: 15, maxScore: 25, explanation: "Есть структура." },
    { id: "tone", criterion: "Управленческий тон", score: 15, maxScore: 25, explanation: "Тон требует доработки." },
    { id: "legal", criterion: "Юридическая безопасность", score: 15, maxScore: 25, explanation: "Есть риск." },
    { id: "next_step", criterion: "Качество следующего шага", score: 15, maxScore: 25, explanation: "Шаг обозначен." },
  ],
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
    expect(markup).toContain("ИТОГОВЫЙ БАЛЛ БЕЗ ОПРЕДЕЛЕНИЯ ПОБЕДИТЕЛЯ");
    expect(markup).toContain("Зелёная зона");
    expect(markup).toContain("0–29");
    expect(markup).toContain("30–59");
    expect(markup).toContain("60–100");
    expect(markup).toContain("ОЦЕНКА ПО ЧЕТЫРЁМ НЕЗАВИСИМЫМ ШКАЛАМ");
    expect(markup).not.toContain("РЕЗУЛЬТАТ ПОЕДИНКА");
    expect(markup).not.toContain("Ничья — явного победителя нет");
  });

  it("не называет старую рубрику из пяти критериев четырьмя независимыми шкалами", () => {
    const legacyAnalysis: NegotiationAnalysis = {
      ...analysis,
      scoreBreakdown: [
        { id: "goal", criterion: "Продвижение к цели", score: 10, maxScore: 20, explanation: "Архивная оценка." },
        { id: "interests", criterion: "Разведка интересов", score: 10, maxScore: 20, explanation: "Архивная оценка." },
        { id: "control", criterion: "Управление позицией", score: 10, maxScore: 20, explanation: "Архивная оценка." },
        { id: "value", criterion: "Создание ценности", score: 10, maxScore: 20, explanation: "Архивная оценка." },
        { id: "agreement", criterion: "Качество договорённостей", score: 10, maxScore: 20, explanation: "Архивная оценка." },
      ],
    };
    const markup = renderToStaticMarkup(
      <NegotiationReport
        analysis={legacyAnalysis}
        methodologyId="dismissal_1c"
        opponentName="Алексей Морозов"
        reportMeta={{
          occurredAt: "2026-08-24T17:13:00.000Z",
          caseTitle: "1С Увольнение",
          userFullName: "Мария Соколова",
          participantRole: "Руководитель практики 1С",
        }}
      />,
    );

    expect(markup).toContain("ОЦЕНКА ПО РУБРИКЕ СОХРАНЁННОГО ОТЧЁТА");
    expect(markup).not.toContain("ОЦЕНКА ПО ЧЕТЫРЁМ НЕЗАВИСИМЫМ ШКАЛАМ");
  });
});
