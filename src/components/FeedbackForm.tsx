"use client";

import { useRef, useState } from "react";
import { FEEDBACK_SECTIONS, type FeedbackSection } from "@/lib/feedback";
import { readJsonResponse } from "@/lib/http-response";

type ApiPayload = { error?: string; text?: string };

export default function FeedbackForm() {
  const [section, setSection] = useState<FeedbackSection>("negotiations");
  const [customSection, setCustomSection] = useState("");
  const [content, setContent] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setError("");
    try {
      const form = new FormData();
      const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", blob, `feedback.${extension}`);
      const response = await fetch("/api/feedback/transcribe", { method: "POST", body: form });
      const { payload } = await readJsonResponse<ApiPayload>(response);
      if (!response.ok || !payload?.text) throw new Error(payload?.error || "Не удалось расшифровать запись.");
      setContent((current) => [current.trim(), payload.text?.trim()].filter(Boolean).join("\n\n"));
    } catch (transcriptionError) {
      setError(transcriptionError instanceof Error ? transcriptionError.message : "Не удалось расшифровать запись.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    setError("");
    setSuccess(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Запись с микрофона не поддерживается этим браузером.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("Не удалось записать голосовое сообщение.");
        setRecording(false);
        releaseMicrophone();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        releaseMicrophone();
        void transcribe(blob);
      };
      recorder.start();
      setRecording(true);
    } catch (recordingError) {
      releaseMicrophone();
      setError(recordingError instanceof Error ? recordingError.message : "Не удалось получить доступ к микрофону.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, customSection, content }),
      });
      const { payload } = await readJsonResponse<ApiPayload>(response);
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить обратную связь.");
      setContent("");
      setCustomSection("");
      setSuccess(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Не удалось отправить обратную связь.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = recording || transcribing || submitting;

  return (
    <form className="feedback-form neon-panel" onSubmit={submit}>
      <div className="feedback-field">
        <label htmlFor="feedback-section">Раздел / функциональность</label>
        <select id="feedback-section" value={section} onChange={(event) => setSection(event.target.value as FeedbackSection)} disabled={busy}>
          {FEEDBACK_SECTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      {section === "other" && (
        <div className="feedback-field">
          <label htmlFor="feedback-custom-section">Укажите раздел или функциональность</label>
          <input id="feedback-custom-section" value={customSection} onChange={(event) => setCustomSection(event.target.value)} maxLength={120} disabled={busy} />
        </div>
      )}
      <div className="feedback-field">
        <div className="feedback-message-label">
          <label htmlFor="feedback-content">Содержание обратной связи</label>
          <span>{content.length} / 5000</span>
        </div>
        <textarea
          id="feedback-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          rows={10}
          placeholder="Опишите, что работает хорошо, что вызывает трудности или что стоит улучшить."
          disabled={recording || submitting}
        />
      </div>
      <div className="feedback-voice">
        <button className={`feedback-mic ${recording ? "recording" : ""}`} type="button" onClick={recording ? stopRecording : startRecording} disabled={transcribing || submitting}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6" /></svg>
          {recording ? "Завершить запись" : transcribing ? "Расшифровываем…" : "Записать голосом"}
        </button>
        <p>{recording ? "Говорите. После завершения запись будет расшифрована." : "Аудио отправляется в OpenAI только для расшифровки и не сохраняется."}</p>
      </div>
      {error && <div className="feedback-notice error" role="alert">{error}</div>}
      {success && <div className="feedback-notice success" role="status">Спасибо! Обратная связь отправлена администратору.</div>}
      <button className="feedback-submit" type="submit" disabled={busy || !content.trim() || (section === "other" && !customSection.trim())}>
        {submitting ? "ОТПРАВЛЯЕМ…" : "ОТПРАВИТЬ ОБРАТНУЮ СВЯЗЬ"}
      </button>
    </form>
  );
}
