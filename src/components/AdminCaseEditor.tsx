"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CanonicalCase, CaseRole, MethodologyBasis } from "@/lib/case-types";

type EditableCase = Omit<CanonicalCase, "id" | "slug"> & {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  createdBy: string;
  methodologyBasis: MethodologyBasis[];
};

function lines(value: string[]) { return value.join("\n"); }
function split(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }

function RoleEditor({ label, role, onChange, removable, onRemove }: { label: string; role: CaseRole; onChange: (role: CaseRole) => void; removable?: boolean; onRemove?: () => void }) {
  function field<K extends keyof CaseRole>(key: K, value: CaseRole[K]) { onChange({ ...role, [key]: value }); }
  return (
    <article className="admin-role-editor">
      <header><div><span>{label}</span><strong>{role.name || "Новая роль"}</strong></div>{removable && <button type="button" onClick={onRemove}>Удалить роль</button>}</header>
      <div className="admin-editor-grid two">
        <label><span>Имя и фамилия</span><input value={role.name} onChange={(event) => field("name", event.target.value)} /></label>
        <label><span>Должность</span><input value={role.position} onChange={(event) => field("position", event.target.value)} /></label>
        <label><span>Пол голоса</span><select value={role.voiceGender} onChange={(event) => field("voiceGender", event.target.value as CaseRole["voiceGender"])}><option value="male">Мужской</option><option value="female">Женский</option></select></label>
        <label className="wide"><span>Публичная цель</span><textarea value={role.publicGoal} onChange={(event) => field("publicGoal", event.target.value)} /></label>
        <label><span>Интересы — по одному на строке</span><textarea value={lines(role.interests)} onChange={(event) => field("interests", split(event.target.value))} /></label>
        <label><span>Ограничения — по одному на строке</span><textarea value={lines(role.constraints)} onChange={(event) => field("constraints", split(event.target.value))} /></label>
        <label><span>Скрытые мотивы — по одному на строке</span><textarea value={lines(role.hiddenMotives)} onChange={(event) => field("hiddenMotives", split(event.target.value))} /></label>
        <label><span>Рычаги влияния — по одному на строке</span><textarea value={lines(role.leverage)} onChange={(event) => field("leverage", split(event.target.value))} /></label>
      </div>
    </article>
  );
}

const emptyRole = (): CaseRole => ({ name: "", position: "", voiceGender: "male", publicGoal: "", interests: [], constraints: [], hiddenMotives: [], leverage: [] });

export default function AdminCaseEditor({ initialCase }: { initialCase: EditableCase }) {
  const router = useRouter();
  const [item, setItem] = useState(initialCase);
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function set<K extends keyof EditableCase>(key: K, value: EditableCase[K]) { setItem((current) => ({ ...current, [key]: value })); }
  function setAdditional(index: number, role: CaseRole) { set("additionalRoles", item.additionalRoles.map((entry, entryIndex) => entryIndex === index ? role : entry)); }

  async function save() {
    setStatus("saving"); setError(""); setMessage("");
    const response = await fetch(`/api/admin/cases/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) setError(payload.error || "Не удалось сохранить кейс.");
    else { setMessage("Изменения сохранены. Комикс для опубликованного кейса поставлен на обновление."); router.refresh(); }
    setStatus("idle");
  }

  async function remove() {
    if (!window.confirm(`Безвозвратно удалить кейс «${item.title}»?`)) return;
    setStatus("deleting"); setError("");
    const response = await fetch(`/api/admin/cases/${item.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) { setError(payload.error || "Не удалось удалить кейс."); setStatus("idle"); }
    else router.push("/admin/cases");
  }

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">РЕДАКТОР КЕЙСА</span><h1>{item.title}</h1><p>Все канонические параметры, роли, методическая основа и состояние публикации.</p></div>
        <Link className="admin-primary-link" href="/admin/cases">← К СПИСКУ КЕЙСОВ</Link>
      </header>
      {error && <div className="error-banner"><strong>Не удалось сохранить</strong><span>{error}</span></div>}
      {message && <div className="admin-success-banner">✓ {message}</div>}
      <section className="admin-case-editor">
        <div className="admin-editor-toolbar">
          <div><span>Код: {item.slug}</span><span>ID: {item.id}</span></div>
          <div><button className="danger" type="button" disabled={status !== "idle"} onClick={remove}>{status === "deleting" ? "Удаляем…" : "Удалить кейс"}</button><button className="primary" type="button" disabled={status !== "idle"} onClick={save}>{status === "saving" ? "Сохраняем…" : "Сохранить изменения"}</button></div>
        </div>

        <article className="admin-editor-section">
          <h2>Основные параметры</h2>
          <div className="admin-editor-grid two">
            <label><span>Название</span><input value={item.title} onChange={(event) => set("title", event.target.value)} /></label>
            <label><span>Кто загрузил / сгенерировал</span><input value={item.createdBy} onChange={(event) => set("createdBy", event.target.value)} /></label>
            <label><span>Статус</span><select value={item.status} onChange={(event) => set("status", event.target.value as EditableCase["status"])}><option value="published">Опубликован</option><option value="draft">Черновик</option><option value="archived">В архиве</option></select></label>
            <label><span>Источник</span><select value={item.origin} onChange={(event) => set("origin", event.target.value as EditableCase["origin"])}><option value="builder">AI-конструктор</option><option value="quick_upload">Быстрая загрузка</option><option value="seed">Системный</option></select></label>
            <label className="wide"><span>Краткое описание</span><textarea value={item.summary} onChange={(event) => set("summary", event.target.value)} /></label>
            <label className="wide"><span>Ситуация</span><textarea value={item.situation} onChange={(event) => set("situation", event.target.value)} /></label>
            <label className="wide"><span>Центральный конфликт</span><textarea value={item.conflict} onChange={(event) => set("conflict", event.target.value)} /></label>
            <label><span>Стартовая ситуация</span><textarea value={item.startSituation} onChange={(event) => set("startSituation", event.target.value)} /></label>
            <label><span>Почему кейс сложный</span><textarea value={item.difficultyReason} onChange={(event) => set("difficultyReason", event.target.value)} /></label>
            <label><span>Ставки — по одной на строке</span><textarea value={lines(item.stakes)} onChange={(event) => set("stakes", split(event.target.value))} /></label>
            <label><span>Критерии оценки — по одному на строке</span><textarea value={lines(item.evaluationFocus)} onChange={(event) => set("evaluationFocus", split(event.target.value))} /></label>
          </div>
        </article>

        <article className="admin-editor-section">
          <div className="admin-editor-section-title"><h2>Роли</h2>{item.additionalRoles.length < 2 && <button type="button" onClick={() => set("additionalRoles", [...item.additionalRoles, emptyRole()])}>＋ Добавить роль</button>}</div>
          <div className="admin-role-editor-list">
            <RoleEditor label="Роль 1" role={item.userRole} onChange={(role) => set("userRole", role)} />
            <RoleEditor label="Роль 2" role={item.opponentRole} onChange={(role) => set("opponentRole", role)} />
            {item.additionalRoles.map((role, index) => <RoleEditor key={index} label={`Дополнительная роль ${index + 1}`} role={role} onChange={(next) => setAdditional(index, next)} removable onRemove={() => set("additionalRoles", item.additionalRoles.filter((_, entryIndex) => entryIndex !== index))} />)}
          </div>
        </article>

        <article className="admin-editor-section">
          <div className="admin-editor-section-title"><h2>Методическая основа</h2><button type="button" onClick={() => set("methodologyBasis", [...item.methodologyBasis, { atomId: "", title: "", application: "" }])}>＋ Добавить принцип</button></div>
          <div className="admin-methodology-editor">
            {item.methodologyBasis.map((basis, index) => (
              <div key={index}>
                <input placeholder="ID атома" value={basis.atomId} onChange={(event) => set("methodologyBasis", item.methodologyBasis.map((entry, i) => i === index ? { ...entry, atomId: event.target.value } : entry))} />
                <input placeholder="Название принципа" value={basis.title} onChange={(event) => set("methodologyBasis", item.methodologyBasis.map((entry, i) => i === index ? { ...entry, title: event.target.value } : entry))} />
                <textarea placeholder="Применение в кейсе" value={basis.application} onChange={(event) => set("methodologyBasis", item.methodologyBasis.map((entry, i) => i === index ? { ...entry, application: event.target.value } : entry))} />
                <button type="button" onClick={() => set("methodologyBasis", item.methodologyBasis.filter((_, i) => i !== index))}>Удалить</button>
              </div>
            ))}
            {!item.methodologyBasis.length && <p>Методические принципы пока не указаны.</p>}
          </div>
        </article>
        <div className="admin-editor-bottom"><button className="primary" type="button" disabled={status !== "idle"} onClick={save}>{status === "saving" ? "Сохраняем…" : "Сохранить изменения"}</button></div>
      </section>
    </>
  );
}
