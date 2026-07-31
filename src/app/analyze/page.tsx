"use client";

import { useRef, useState } from "react";
import type { DuelFileAnalysis, DuelParticipantFeedback } from "@/lib/duel-file-analysis-types";
import { DUEL_AUDIO_MAX_BYTES, formatDiarizedTranscript, validateDuelAudioMetadata, type DuelAudioTranscription } from "@/lib/duel-audio";
import { DEFAULT_METHODOLOGY_ID, methodologyOptions, type MethodologyId } from "@/lib/methodologies";

type Status = "idle" | "transcribing" | "analyzing" | "ready" | "error";
type TranscriptSource = "text" | "audio";

export default function AnalyzePage() {
  const [caseFile, setCaseFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<File | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource>("text");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTranscription, setAudioTranscription] = useState<DuelAudioTranscription | null>(null);
  const [participant1Speaker, setParticipant1Speaker] = useState("");
  const [participant2Speaker, setParticipant2Speaker] = useState("");
  const [participant1Name, setParticipant1Name] = useState("Участник 1");
  const [participant2Name, setParticipant2Name] = useState("Участник 2");
  const [methodologyId, setMethodologyId] = useState<MethodologyId>(DEFAULT_METHODOLOGY_ID);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<DuelFileAnalysis | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);

  const speakerMappingIsValid = Boolean(
    audioTranscription && participant1Speaker && participant2Speaker && participant1Speaker !== participant2Speaker,
  );
  const audioTranscriptText = audioTranscription
    ? formatDiarizedTranscript(audioTranscription.segments, {
        [participant1Speaker]: participant1Name,
        [participant2Speaker]: participant2Name,
      })
    : "";
  const busy = status === "transcribing" || status === "analyzing";

  function selectTranscriptSource(source: TranscriptSource) {
    setTranscriptSource(source);
    setError("");
    setStatus("idle");
    setAnalysis(null);
  }

  function selectAudioFile(file: File | null) {
    setAudioTranscription(null);
    setParticipant1Speaker("");
    setParticipant2Speaker("");
    setError("");
    if (!file) return setAudioFile(null);
    try {
      validateDuelAudioMetadata({ fileName: file.name, sizeBytes: file.size, mimeType: file.type });
      setAudioFile(file);
    } catch (validationError) {
      setAudioFile(null);
      setStatus("error");
      setError(validationError instanceof Error ? validationError.message : "Некорректный аудиофайл.");
    }
  }

  async function transcribeAudio() {
    if (!audioFile) return;
    setStatus("transcribing");
    setError("");
    setAnalysis(null);
    try {
      const prepareResponse = await fetch("/api/duel-transcription/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: audioFile.name, sizeBytes: audioFile.size, mimeType: audioFile.type }),
      });
      const prepared = await prepareResponse.json() as { path?: string; signedUrl?: string; error?: string };
      if (!prepareResponse.ok || !prepared.path || !prepared.signedUrl) {
        throw new Error(prepared.error || "Не удалось подготовить загрузку аудио.");
      }

      const uploadBody = new FormData();
      uploadBody.append("cacheControl", "3600");
      uploadBody.append("", audioFile);
      const uploadResponse = await fetch(prepared.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body: uploadBody,
      });
      if (!uploadResponse.ok) throw new Error("Не удалось загрузить аудиофайл. Попробуйте ещё раз.");

      const transcriptionResponse = await fetch("/api/duel-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: prepared.path,
          fileName: audioFile.name,
          sizeBytes: audioFile.size,
          mimeType: audioFile.type,
        }),
      });
      const payload = await transcriptionResponse.json() as (DuelAudioTranscription & { error?: string });
      if (!transcriptionResponse.ok || !payload.segments?.length) {
        throw new Error(payload.error || "Не удалось расшифровать аудиозапись.");
      }

      setAudioTranscription(payload);
      setParticipant1Speaker(payload.speakers[0] || "");
      setParticipant2Speaker(payload.speakers[1] || "");
      setStatus("idle");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось расшифровать аудиозапись.");
      setStatus("error");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseFile) return;
    if (transcriptSource === "audio" && !audioTranscription) return transcribeAudio();
    if (transcriptSource === "text" && !transcript) return;
    if (transcriptSource === "audio" && !speakerMappingIsValid) return;
    setStatus("analyzing");
    setError("");
    setAnalysis(null);
    const form = new FormData();
    form.set("caseFile", caseFile);
    form.set("transcript", transcriptSource === "text"
      ? transcript as File
      : new File([audioTranscriptText], `${audioFile?.name || "audio"}-transcript.txt`, { type: "text/plain" }));
    form.set("participant1Name", participant1Name);
    form.set("participant2Name", participant2Name);
    form.set("methodologyId", methodologyId);
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
        <h1>Загрузите кейс и запись переговоров</h1>
        <p>Добавьте готовую текстовую расшифровку или аудиозапись. Анализатор сопоставит разговор с условиями кейса и методологией, определит победителя и даст обратную связь каждому участнику.</p>
      </header>

      <form className="analysis-upload-form neon-panel" onSubmit={submit}>
        <div className="analysis-source-switch" role="group" aria-label="Формат записи переговоров">
          <button type="button" className={transcriptSource === "text" ? "active" : ""} onClick={() => selectTranscriptSource("text")}>ТЕКСТОВАЯ РАСШИФРОВКА</button>
          <button type="button" className={transcriptSource === "audio" ? "active" : ""} onClick={() => selectTranscriptSource("audio")}>АУДИОЗАПИСЬ ДО 25 МБ</button>
        </div>
        <div className="analysis-upload-files">
          <FileField number="01" title="Текст кейса" hint="Роли, цели, конфликт и ограничения сторон" file={caseFile} onChange={setCaseFile} />
          {transcriptSource === "text"
            ? <FileField number="02" title="Расшифровка поединка" hint="Диалог с понятными метками двух спикеров" file={transcript} onChange={setTranscript} />
            : <AudioFileField file={audioFile} onChange={selectAudioFile} />}
        </div>
        <div className="participant-name-fields">
          <label><span>УЧАСТНИК 1</span><input value={participant1Name} onChange={(event) => setParticipant1Name(event.target.value)} maxLength={80} required /></label>
          <label><span>УЧАСТНИК 2</span><input value={participant2Name} onChange={(event) => setParticipant2Name(event.target.value)} maxLength={80} required /></label>
        </div>
        {transcriptSource === "audio" && audioTranscription && (
          <section className="audio-transcription-review">
            <header>
              <div><span>РАСШИФРОВКА ГОТОВА</span><strong>{Math.ceil(audioTranscription.duration / 60)} мин · спикеров: {audioTranscription.speakers.length}</strong></div>
              <small>Проверьте, кому принадлежит каждый голос, перед запуском анализа.</small>
            </header>
            <div className="audio-speaker-mapping">
              <label><span>{participant1Name || "Участник 1"}</span><select value={participant1Speaker} onChange={(event) => setParticipant1Speaker(event.target.value)}><option value="">Выберите голос</option>{audioTranscription.speakers.map((speaker) => <option key={speaker} value={speaker}>Спикер {speaker}</option>)}</select></label>
              <label><span>{participant2Name || "Участник 2"}</span><select value={participant2Speaker} onChange={(event) => setParticipant2Speaker(event.target.value)}><option value="">Выберите голос</option>{audioTranscription.speakers.map((speaker) => <option key={speaker} value={speaker}>Спикер {speaker}</option>)}</select></label>
            </div>
            {!speakerMappingIsValid && <p>Для анализа выберите два разных голоса участников.</p>}
            <textarea value={audioTranscriptText} readOnly aria-label="Предварительный просмотр расшифровки" />
          </section>
        )}
        <label className="analysis-methodology-field"><span>МЕТОДОЛОГИЯ ПЕРЕГОВОРОВ</span><select value={methodologyId} onChange={(event) => setMethodologyId(event.target.value as MethodologyId)}>{methodologyOptions().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <p className="analysis-format-note">{transcriptSource === "text" ? "Текстовые форматы: TXT, MD, CSV, RTF, DOCX, PDF, JSON, XML, HTML и LOG. Общий размер файлов — до 4 МБ." : "Аудиоформаты: FLAC, MP3, MPEG, MPGA, M4A, OGG, WAV и WebM. Максимальный размер аудиозаписи — 25 МБ. Видео пока не поддерживается."}</p>
        <button className="analysis-submit" disabled={!caseFile || busy || (transcriptSource === "text" ? !transcript : !audioFile || Boolean(audioTranscription && !speakerMappingIsValid))}>
          {status === "transcribing" ? "ЗАГРУЖАЕМ И РАСШИФРОВЫВАЕМ…" : status === "analyzing" ? "АНАЛИЗИРУЕМ…" : transcriptSource === "audio" && !audioTranscription ? "РАСШИФРОВАТЬ АУДИО" : "ПРОАНАЛИЗИРОВАТЬ"}
        </button>
        {busy && <div className="analysis-upload-progress"><span className="analysis-spinner" /><p>{status === "transcribing" ? "Загружаем аудиозапись, распознаём речь и разделяем голоса участников…" : "Изучаем условия кейса, определяем роли и сопоставляем реплики с методологией…"}</p></div>}
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

function AudioFileField({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className={`analysis-file-field ${file ? "selected" : ""}`}>
      <input type="file" accept=".flac,.mp3,.mpeg,.mpga,.m4a,.ogg,.wav,.webm,audio/*" onChange={(event) => onChange(event.target.files?.[0] || null)} />
      <b>02</b><div><strong>{file ? file.name : "Аудиозапись поединка"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} МБ · файл выбран` : `Только аудио · не больше ${DUEL_AUDIO_MAX_BYTES / 1024 / 1024} МБ`}</span></div><i>{file ? "✓" : "+"}</i>
    </label>
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
