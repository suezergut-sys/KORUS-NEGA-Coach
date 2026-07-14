"use client";

import { useRef, useState } from "react";
import type { DuelFileAnalysis, DuelParticipantFeedback } from "@/lib/duel-file-analysis-types";

type Status = "idle" | "loading" | "ready" | "error";

export default function AnalyzePage() {
  const [caseFile, setCaseFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<File | null>(null);
  const [participant1Name, setParticipant1Name] = useState("Участник 1");
  const [participant2Name, setParticipant2Name] = useState("Участник 2");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<DuelFileAnalysis | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseFile || !transcript) return;
    setStatus("loading");
    setError("");
    setAnalysis(null);
    const form = new FormData();
    form.set("caseFile", caseFile);
    form.set("transcript", transcript);
    form.set("participant1Name", participant1Name);
    form.set("participant2Name", participant2Name);
    try {
      const response = await fetch("/api/duel-analysis", { method: "POST", body: form });
      const payload = await response.json() as { analysis?: DuelFileAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Не удалось получить отчёт.");
      setAnalysis(payload.analysis);
      setStatus("ready");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось получить отчёт.");
      setStatus("error");
    }
  }

  return (
    <div className="analysis-upload-page">
      <header className="analysis-upload-hero">
        <span>АНАЛИЗ ПРОВЕДЁННОГО ПОЕДИНКА</span>
        <h1>Загрузите кейс и расшифровку переговоров</h1>
        <p>Анализатор сопоставит ход разговора с условиями кейса и методологией, определит победителя и даст отдельную обратную связь каждому участнику.</p>
      </header>

      <form className="analysis-upload-form neon-panel" onSubmit={submit}>
        <div className="analysis-upload-files">
          <FileField number="01" title="Текст кейса" hint="Роли, цели, конфликт и ограничения сторон" file={caseFile} onChange={setCaseFile} />
          <FileField number="02" title="Расшифровка поединка" hint="Диалог с понятными метками двух спикеров" file={transcript} onChange={setTranscript} />
        </div>
        <div className="participant-name-fields">
          <label><span>УЧАСТНИК 1</span><input value={participant1Name} onChange={(event) => setParticipant1Name(event.target.value)} maxLength={80} required /></label>
          <label><span>УЧАСТНИК 2</span><input value={participant2Name} onChange={(event) => setParticipant2Name(event.target.value)} maxLength={80} required /></label>
        </div>
        <p className="analysis-format-note">Форматы: TXT, MD, CSV, RTF, DOCX, PDF, JSON, XML, HTML и LOG. Общий размер — до 4 МБ.</p>
        <button className="analysis-submit" disabled={!caseFile || !transcript || status === "loading"}>
          {status === "loading" ? "АНАЛИЗИРУЕМ…" : "ПРОАНАЛИЗИРОВАТЬ"}
        </button>
        {status === "loading" && <div className="analysis-upload-progress"><span className="analysis-spinner" /><p>Изучаем условия кейса, определяем роли и сопоставляем реплики с методологией…</p></div>}
        {status === "error" && <div className="analysis-upload-error">{error}</div>}
      </form>

      {status === "ready" && analysis && (
        <section className="file-analysis-report analysis-card" ref={resultRef}>
          <header className="analysis-header"><div><span>ИТОГОВЫЙ ОТЧЁТ</span><h2>{analysis.summary}</h2></div></header>
          <p className="analysis-disclaimer">{analysis.disclaimer}</p>
          <section className={`duel-outcome ${analysis.outcome.winner === "participant1" ? "user" : analysis.outcome.winner === "participant2" ? "opponent" : "draw"}`}>
            <div className="outcome-symbol">{analysis.outcome.winner === "draw" ? "=" : "★"}</div>
            <div><span>РЕЗУЛЬТАТ ПОЕДИНКА · УВЕРЕННОСТЬ {Math.round(analysis.outcome.confidence * 100)}%</span><h3>{analysis.outcome.winner === "participant1" ? `Победитель — ${analysis.participant1.name}` : analysis.outcome.winner === "participant2" ? `Победитель — ${analysis.participant2.name}` : "Ничья — явного победителя нет"}</h3><p>{analysis.outcome.verdict}</p><ul>{analysis.outcome.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>
          </section>
          {analysis.turningPoints.length > 0 && <section className="analysis-section turning-points"><h3>ПОВОРОТНЫЕ МОМЕНТЫ</h3>{analysis.turningPoints.map((item, index) => <article key={index}><strong>{item.moment}</strong><p>{item.assessment}</p></article>)}</section>}
          <div className="participant-report-grid">
            <ParticipantReport participant={analysis.participant1} />
            <ParticipantReport participant={analysis.participant2} />
          </div>
          <footer className="report-footer"><span>Версия методологии: {analysis.methodologyVersion}</span></footer>
        </section>
      )}
    </div>
  );
}

function FileField({ number, title, hint, file, onChange }: { number: string; title: string; hint: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className={`analysis-file-field ${file ? "selected" : ""}`}>
      <input type="file" accept=".txt,.md,.markdown,.csv,.rtf,.docx,.pdf,.json,.xml,.html,.htm,.log" onChange={(event) => onChange(event.target.files?.[0] || null)} />
      <b>{number}</b><div><strong>{file ? file.name : title}</strong><span>{file ? `${(file.size / 1024).toFixed(0)} КБ · файл выбран` : hint}</span></div><i>{file ? "✓" : "+"}</i>
    </label>
  );
}

function ParticipantReport({ participant }: { participant: DuelParticipantFeedback }) {
  return (
    <article className="participant-report">
      <header><div><span>ПЕРСОНАЛЬНАЯ ОБРАТНАЯ СВЯЗЬ</span><h2>{participant.name}</h2></div><strong>{participant.score}<small>/100</small></strong></header>
      <p className="participant-summary">{participant.summary}</p>
      <div className="analysis-grid"><List title="СИЛЬНЫЕ СТОРОНЫ" items={participant.strengths} tone="positive" /><List title="ЧТО УЛУЧШИТЬ" items={participant.improvements} tone="negative" /></div>
      {participant.techniqueReview.length > 0 && <section className="technique-review"><h3>РАЗБОР ПРИЁМОВ</h3>{participant.techniqueReview.map((item, index) => <article key={index} className={item.status}><header><strong>{item.technique}</strong><span>{item.status === "successful" ? "Успешно" : item.status === "partial" ? "Частично" : "Упущено"}</span></header><div className="quote-pair"><blockquote><small>РЕПЛИКА УЧАСТНИКА</small>«{item.turnQuote}»</blockquote><blockquote><small>МЕТОДОЛОГИЯ</small>«{item.sourceQuote}»</blockquote></div><p>{item.explanation}</p><footer><span>{item.section}</span></footer></article>)}</section>}
      <section className="development-plan"><h3>РЕКОМЕНДАЦИИ ПО РАЗВИТИЮ</h3><div>{participant.recommendations.map((item, index) => <article key={index}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.skill}</strong><p>{item.why}</p><small>Практика: {item.practice}</small></div></article>)}</div></section>
    </article>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "negative" }) {
  return <section className={`analysis-list ${tone}`}><h3>{title}</h3><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></section>;
}
