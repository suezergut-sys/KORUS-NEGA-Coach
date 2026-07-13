"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminCaseListItem = {
  id: string;
  title: string;
  createdAt: string;
  createdBy: string;
  origin: string;
  status: string;
  plays: number;
  mediaStatus: string;
  roleStatuses: Array<{ name: string; ready: boolean }>;
};

const originLabels: Record<string, string> = { seed: "Системный", quick_upload: "Загружен", builder: "Сгенерирован" };
const statusLabels: Record<string, string> = { draft: "Черновик", published: "Опубликован", archived: "В архиве" };
const mediaLabels: Record<string, string> = { pending: "В очереди", processing: "Создаётся", ready: "Готов", failed: "Ошибка", missing: "Не запущен" };

export default function AdminCaseList({ initialCases }: { initialCases: AdminCaseListItem[] }) {
  const router = useRouter();
  const [cases, setCases] = useState(initialCases);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function remove(item: AdminCaseListItem) {
    if (!window.confirm(`Удалить кейс «${item.title}» и его комиксы с озвучкой? История и результаты отыгрышей сохранятся без привязки к удалённому кейсу.`)) return;
    setBusyId(item.id);
    setError("");
    const response = await fetch(`/api/admin/cases/${item.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) setError(payload.error || "Не удалось удалить кейс.");
    else {
      setCases((current) => current.filter((entry) => entry.id !== item.id));
      router.refresh();
    }
    setBusyId("");
  }

  return (
    <>
      {error && <div className="error-banner"><strong>Не удалось выполнить действие</strong><span>{error}</span></div>}
      <div className="admin-case-table-wrap">
        <table className="admin-case-table">
          <thead><tr><th>Кейс</th><th>Загружен</th><th>Автор / источник</th><th>Комикс для ролей</th><th>Отыгрыши</th><th>Действия</th></tr></thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong><span className={`admin-case-state ${item.status}`}>{statusLabels[item.status] || item.status}</span></td>
                <td><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(item.createdAt))}</time></td>
                <td><strong>{item.createdBy}</strong><small>{originLabels[item.origin] || item.origin}</small></td>
                <td>
                  <span className={`admin-media-state ${item.mediaStatus}`}>{mediaLabels[item.mediaStatus] || item.mediaStatus}</span>
                  <div className="admin-role-statuses">{item.roleStatuses.map((role, index) => <span className={role.ready ? "ready" : "waiting"} key={`${role.name}-${index}`} title={role.ready ? "Комикс готов" : "Комикс ещё не готов"}>{role.ready ? "✓" : "○"} {role.name}</span>)}</div>
                </td>
                <td><strong className="admin-play-count">{item.plays}</strong></td>
                <td><div className="admin-case-actions"><Link href={`/admin/cases/${item.id}`}>Редактировать</Link><button disabled={busyId === item.id} onClick={() => remove(item)}>{busyId === item.id ? "Удаляем…" : "Удалить"}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cases.length && <div className="admin-empty">В базе пока нет кейсов.</div>}
      </div>
    </>
  );
}
