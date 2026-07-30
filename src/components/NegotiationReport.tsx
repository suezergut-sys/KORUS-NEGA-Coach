import Link from "next/link";
import type { NegotiationAnalysis } from "@/lib/analysis-types";
import { getMethodology, type MethodologyId } from "@/lib/methodologies";
import type { SpeechAnalytics } from "@/lib/speech-analytics";

export default function NegotiationReport({
  analysis,
  methodologyId,
  opponentName,
  speechAnalytics,
}: {
  analysis: NegotiationAnalysis;
  methodologyId: MethodologyId;
  opponentName: string;
  speechAnalytics?: SpeechAnalytics | null;
}) {
  const methodology = getMethodology(methodologyId);
  const confidence = Number(analysis.outcome.confidence);
  const confidenceLabel = Number.isFinite(confidence)
    ? `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`
    : "НЕТ ДАННЫХ";
  return (
    <>
      <header className="analysis-header">
        <div><span>ИТОГОВЫЙ ОТЧЁТ ПО ПОЕДИНКУ</span><h2>{analysis.summary}</h2></div>
        <div className="analysis-score"><strong>{analysis.overallScore}</strong><small>/ 100</small></div>
      </header>
      <p className="analysis-disclaimer">{analysis.disclaimer}</p>
      <section className={`duel-outcome ${analysis.outcome.winner}`}>
        <div className="outcome-symbol">{analysis.outcome.winner === "user" ? "★" : analysis.outcome.winner === "opponent" ? "◆" : "="}</div>
        <div>
          <span>РЕЗУЛЬТАТ ПОЕДИНКА · УВЕРЕННОСТЬ {confidenceLabel}</span>
          <h3>{analysis.outcome.winner === "user" ? "Победил участник" : analysis.outcome.winner === "opponent" ? `Победил оппонент — ${opponentName}` : "Ничья — явного победителя нет"}</h3>
          <p>{analysis.outcome.verdict}</p>
          <ul>{analysis.outcome.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        </div>
      </section>

      <section className="personal-feedback">
        <span>ПЕРСОНАЛЬНАЯ ОБРАТНАЯ СВЯЗЬ</span><p>{analysis.personalFeedback}</p>
      </section>

      {speechAnalytics && <SpeechAnalyticsPanel analytics={speechAnalytics} />}

      {analysis.scoreBreakdown.length > 0 && (
        <section className="score-breakdown">
          <h3>ОЦЕНКА ПО ЕДИНОЙ РУБРИКЕ</h3>
          <div>{analysis.scoreBreakdown.map((item) => (
            <article key={`${item.id || item.criterion}-${item.criterion}`}>
              <header><strong>{item.criterion}</strong><span>{item.score} / {item.maxScore}</span></header>
              <i><b style={{ width: `${Math.min(100, (item.score / item.maxScore) * 100)}%` }} /></i>
              <p>{item.explanation}</p>
            </article>
          ))}</div>
        </section>
      )}
      <div className="analysis-grid">
        <AnalysisList title="СИЛЬНЫЕ ХОДЫ" items={analysis.strengths} tone="positive" />
        <AnalysisList title="РИСКИ" items={analysis.risks} tone="negative" />
      </div>

      {analysis.turningPoints.length > 0 && (
        <section className="analysis-section turning-points">
          <h3>ПОВОРОТНЫЕ МОМЕНТЫ</h3>
          {analysis.turningPoints.map((item, index) => <article key={index}><strong>{item.moment}</strong><p>{item.assessment}</p></article>)}
        </section>
      )}

      {analysis.stratagems.length > 0 && (
        <section className="analysis-section stratagem-review">
          <h3>СТРАТАГЕМЫ И ПРИЁМЫ</h3>
          <div>{analysis.stratagems.map((item, index) => (
            <article key={index} className={item.status}><span>{item.status === "observed" ? "Наблюдалась" : item.status === "possible" ? "Возможна" : "Упущена"}</span><strong>{item.name}</strong><p>{item.explanation}</p></article>
          ))}</div>
        </section>
      )}

      {analysis.techniqueReview.length > 0 && (
        <section className="technique-review">
          <h3>ПРИЁМЫ: ЧТО СРАБОТАЛО И ГДЕ НЕДОРАБОТАЛ</h3>
          {analysis.techniqueReview.map((item, index) => (
            <article key={index} className={item.status}>
              <header><strong>{item.technique}</strong><span>{item.status === "successful" ? "Успешно" : item.status === "partial" ? "Частично" : "Недоработано"}</span></header>
              <div className="quote-pair">
                <blockquote><small>ВАША РЕПЛИКА</small>«{item.turnQuote}»</blockquote>
                <blockquote><small>{methodology.name.toLocaleUpperCase("ru-RU")}</small>«{item.sourceQuote}»</blockquote>
              </div>
              <p>{item.explanation}</p>
              <footer>
                <span>{item.section}</span>
                {item.methodologyAtomId && <Link href={`/methodology/${methodologyId}?atom=${item.methodologyAtomId}#atom-${item.methodologyAtomId}`}>Открыть методическое объяснение →</Link>}
              </footer>
            </article>
          ))}
        </section>
      )}

      {analysis.evidence.length > 0 && (
        <section className="analysis-section evidence-review">
          <h3>ДОКАЗАТЕЛЬСТВА И УВЕРЕННОСТЬ</h3>
          {analysis.evidence.map((item, index) => (
            <article key={index}>
              <header><strong>{item.section}</strong><span>{Math.round(item.confidence * 100)}%</span></header>
              <div className="quote-pair"><blockquote><small>ВАША РЕПЛИКА</small>«{item.turnQuote}»</blockquote><blockquote><small>ИСТОЧНИК</small>«{item.sourceQuote}»</blockquote></div>
              <p>{item.rationale}</p>
            </article>
          ))}
        </section>
      )}

      {analysis.developmentPlan.length > 0 && (
        <section className="development-plan">
          <h3>ЧТО РАЗВИВАТЬ И ВНЕДРЯТЬ В СВОЙ АРСЕНАЛ</h3>
          <div>{analysis.developmentPlan.map((item, index) => (
            <article key={index}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.skill}</strong><p>{item.why}</p><small>Практика: {item.practice}</small></div></article>
          ))}</div>
        </section>
      )}

      <div className="analysis-section"><h3>АЛЬТЕРНАТИВНЫЕ ХОДЫ</h3><ol>{analysis.alternatives.map((item, index) => <li key={index}>{item}</li>)}</ol></div>
      <footer className="report-footer"><span>Версия методологии: {analysis.methodologyVersion}</span><Link href={`/methodology/${methodologyId}`}>Открыть методическую базу →</Link></footer>
    </>
  );
}

function formatSeconds(milliseconds: number) {
  if (!milliseconds) return "—";
  return `${(milliseconds / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
}

export function SpeechAnalyticsPanel({ analytics }: { analytics: SpeechAnalytics }) {
  const fillerSummary = analytics.fillers.length
    ? analytics.fillers.slice(0, 3).map((item) => `${item.phrase} — ${item.count}`).join(", ")
    : "не обнаружены";
  const fillerPercent = `${analytics.fillerPercent.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
  const unavailableTiming = analytics.timingAvailable
    ? null
    : analytics.timingUnavailableReason === "implausible"
      ? "Аудиометрики отклонены проверкой достоверности"
      : analytics.timingUnavailableReason === "legacy"
        ? "Метрики этой сессии собраны устаревшим способом"
        : "Недостаточно данных о звуке оппонента";
  return (
    <section className="speech-analytics-card">
      <header>
        <div><span>РЕЧЕВАЯ АНАЛИТИКА · ДУПЛЕКС</span><h3>Как вы говорили и реагировали</h3></div>
        <p>Рассчитано по временным событиям голоса и финальной стенограмме. Аудиозапись не сохраняется.</p>
      </header>
      <div className="speech-analytics-grid">
        <article><span>ТЕМП</span><strong>{analytics.tempoWpm || "—"}<small>{analytics.tempoWpm ? " сл/мин" : ""}</small></strong><p>{analytics.words} слов в {analytics.userTurns} репликах</p></article>
        <article><span>СРЕДНЯЯ ПАУЗА ПЕРЕД ОТВЕТОМ</span><strong>{analytics.timingAvailable ? formatSeconds(analytics.averagePauseMs) : "—"}</strong><p>{unavailableTiming || `длинных пауз от 3 сек.: ${analytics.longPauseCount}`}</p></article>
        <article><span>ДОЛЯ ГОВОРЕНИЯ</span><strong>{analytics.timingAvailable ? `${analytics.talkSharePercent}%` : "—"}</strong><p>{unavailableTiming || "ваша доля от суммарного времени речи сторон"}</p></article>
        <article><span>ПЕРЕБИВАНИЯ</span><strong>{analytics.timingAvailable ? analytics.interruptionCount : "—"}</strong><p>{unavailableTiming || "раз начали говорить, пока оппонент ещё говорил"}</p></article>
        <article><span>ВОПРОСЫ</span><strong>{analytics.questionCount}</strong><p>вопросительных формулировок</p></article>
        <article><span>СЛОВА-ПАРАЗИТЫ</span><strong>{fillerPercent}</strong><p>{analytics.fillerWordCount} из {analytics.words} слов · {fillerSummary}</p></article>
        <article className={`pressure-reaction ${analytics.pressureReaction.level}`}>
          <span>РЕАКЦИЯ НА ДАВЛЕНИЕ</span>
          <strong>{analytics.pressureReaction.label}</strong>
          <p>{analytics.pressureReaction.explanation}</p>
        </article>
      </div>
    </section>
  );
}

function AnalysisList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "negative" }) {
  return <div className={`analysis-list ${tone}`}><h3>{title}</h3><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>;
}
