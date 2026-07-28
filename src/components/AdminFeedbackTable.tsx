"use client";

import { useState } from "react";
import { readJsonResponse } from "@/lib/http-response";

export type AdminFeedbackItem = {
  id: string;
  authorName: string;
  authorEmail: string;
  sectionLabel: string;
  content: string;
  processed: boolean;
  createdAt: string;
};

export default function AdminFeedbackTable({ initialItems }: { initialItems: AdminFeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function setProcessed(id: string, processed: boolean) {
    const previous = items;
    setItems((current) => current.map((item) => item.id === id ? { ...item, processed } : item));
    setBusyId(id);
    setError("");
    const response = await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processed }),
    });
    const { payload } = await readJsonResponse<{ error?: string }>(response);
    if (!response.ok) {
      setItems(previous);
      setError(payload?.error || "Не удалось обновить статус обратной связи.");
    }
    setBusyId("");
  }

  return (
    <>
      {error && <div className="error-banner"><strong>Не удалось сохранить</strong><span>{error}</span></div>}
      <div className="admin-feedback-table-wrap">
        <table className="admin-feedback-table">
          <thead>
            <tr><th>От кого</th><th>Когда</th><th>Раздел</th><th>Содержание обратной связи</th><th>Отработано</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className={item.processed ? "processed" : ""} key={item.id}>
                <td><strong>{item.authorName}</strong><small>{item.authorEmail}</small></td>
                <td><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(item.createdAt))}</time></td>
                <td><span className="feedback-section-chip">{item.sectionLabel}</span></td>
                <td><p>{item.content}</p></td>
                <td>
                  <label className="feedback-status-check">
                    <input
                      type="checkbox"
                      checked={item.processed}
                      disabled={busyId === item.id}
                      onChange={(event) => void setProcessed(item.id, event.target.checked)}
                      aria-label={`Отметить обращение от ${item.authorName} как отработанное`}
                    />
                    <span>{item.processed ? "Да" : "Нет"}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <div className="admin-empty">Обратной связи пока нет.</div>}
      </div>
    </>
  );
}
