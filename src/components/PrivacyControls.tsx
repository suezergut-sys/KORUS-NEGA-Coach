"use client";

import { useState } from "react";

export default function PrivacyControls({
  initialConsent,
  initialRetentionDays,
}: {
  initialConsent: boolean;
  initialRetentionDays: number;
}) {
  const [consent, setConsent] = useState(initialConsent);
  const [retentionDays, setRetentionDays] = useState(initialRetentionDays);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/account/privacy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent, retentionDays }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error || "Не удалось сохранить настройки.");
      return;
    }
    setStatus("saved");
    setMessage(consent
      ? "Согласие и срок хранения сохранены."
      : "Согласие отозвано. Новые тренировки нельзя запускать, пока вы снова его не дадите.");
  }

  async function deleteTrainingData() {
    if (!window.confirm("Удалить все ваши тренировки, стенограммы, оценки и метрики? Это действие нельзя отменить.")) return;
    setDeleting(true);
    setMessage("");
    const response = await fetch("/api/account/privacy", { method: "DELETE" });
    const payload = await response.json() as { error?: string; deletedSessions?: number };
    setDeleting(false);
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error || "Не удалось удалить данные.");
      return;
    }
    setStatus("saved");
    setMessage(`Удалено тренировок: ${payload.deletedSessions || 0}. Обновите страницу, чтобы увидеть актуальную статистику.`);
  }

  return (
    <section className="privacy-card neon-panel" id="privacy">
      <header>
        <div><span className="admin-eyebrow">ПРИВАТНОСТЬ И ДАННЫЕ</span><h2>Стенограммы тренировок</h2></div>
        <p>Аудиозапись не сохраняется. Мы храним только текстовые реплики, оценку и технические метрики для отчётов и развития навыка.</p>
      </header>
      <label className="privacy-consent">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span><strong>Я согласен на сохранение стенограмм</strong><small>Без согласия новая голосовая тренировка не запускается.</small></span>
      </label>
      <label className="privacy-retention">
        <span>Срок хранения данных</span>
        <select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
          <option value={180}>180 дней</option>
          <option value={365}>1 год</option>
          <option value={730}>2 года</option>
        </select>
      </label>
      <p className="privacy-rule">По окончании срока сессия, стенограмма, оценка и метрики удаляются автоматически. Срок применяется к новым тренировкам.</p>
      <div className="privacy-actions">
        <button type="button" className="modal-primary" onClick={() => void save()} disabled={status === "saving"}>{status === "saving" ? "СОХРАНЯЕМ…" : "СОХРАНИТЬ НАСТРОЙКИ"}</button>
        <a className="modal-secondary" href="/api/account/export">ЭКСПОРТИРОВАТЬ JSON</a>
        <button type="button" className="privacy-delete" onClick={() => void deleteTrainingData()} disabled={deleting}>{deleting ? "УДАЛЯЕМ…" : "УДАЛИТЬ УЧЕБНЫЕ ДАННЫЕ"}</button>
      </div>
      {message && <p className={status === "error" ? "privacy-message error" : "privacy-message"} role="status">{message}</p>}
    </section>
  );
}
