"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CanonicalCase, CaseRole, MethodologyBasis, NegotiationPair } from "@/lib/case-types";

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
        <label className="wide"><span>Подробная задача роли</span><textarea value={role.roleBrief || ""} onChange={(event) => field("roleBrief", event.target.value)} /></label>
        <label className="wide"><span>Стартовая реплика</span><textarea value={role.openingLine || ""} onChange={(event) => field("openingLine", event.target.value)} /></label>
        <label><span>Типовые возражения — по одному на строке</span><textarea value={lines(role.typicalObjections || [])} onChange={(event) => field("typicalObjections", split(event.target.value))} /></label>
        <label><span>Рекомендуемые реплики — по одной на строке</span><textarea value={lines(role.recommendedPhrases || [])} onChange={(event) => field("recommendedPhrases", split(event.target.value))} /></label>
        <label className="wide"><span>Запрещённые реплики — по одной на строке</span><textarea value={lines(role.forbiddenPhrases || [])} onChange={(event) => field("forbiddenPhrases", split(event.target.value))} /></label>
      </div>
    </article>
  );
}

const emptyRole = (): CaseRole => ({ name: "", position: "", voiceGender: "male", publicGoal: "", interests: [], constraints: [], hiddenMotives: [], leverage: [], roleBrief: "", openingLine: "", typicalObjections: [], recommendedPhrases: [], forbiddenPhrases: [] });

export default function AdminCaseEditor({ initialCase }: { initialCase: EditableCase }) {
  const router = useRouter();
  const [item, setItem] = useState(initialCase);
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function set<K extends keyof EditableCase>(key: K, value: EditableCase[K]) { setItem((current) => ({ ...current, [key]: value })); }
  function setAdditional(index: number, role: CaseRole) { set("additionalRoles", item.additionalRoles.map((entry, entryIndex) => entryIndex === index ? role : entry)); }
  const roles = [item.userRole, item.opponentRole, ...item.additionalRoles];

  function pairFor(roleAIndex: number, roleBIndex: number) {
    return item.negotiationPairs.find((pair) => pair.roleAIndex === roleAIndex && pair.roleBIndex === roleBIndex);
  }

  function togglePair(roleAIndex: number, roleBIndex: number, enabled: boolean) {
    const remaining = item.negotiationPairs.filter((pair) => pair.roleAIndex !== roleAIndex || pair.roleBIndex !== roleBIndex);
    set("negotiationPairs", enabled
      ? [...remaining, { roleAIndex, roleBIndex, reason: "Опишите предмет переговоров и несовместимые интересы ролей." }]
      : remaining);
  }

  function updatePairReason(roleAIndex: number, roleBIndex: number, reason: string) {
    set("negotiationPairs", item.negotiationPairs.map((pair) => pair.roleAIndex === roleAIndex && pair.roleBIndex === roleBIndex ? { ...pair, reason } : pair));
  }

  function removeAdditionalRole(index: number) {
    const removedRoleIndex = index + 2;
    const nextPairs: NegotiationPair[] = item.negotiationPairs
      .filter((pair) => pair.roleAIndex !== removedRoleIndex && pair.roleBIndex !== removedRoleIndex)
      .map((pair) => ({
        ...pair,
        roleAIndex: pair.roleAIndex > removedRoleIndex ? pair.roleAIndex - 1 : pair.roleAIndex,
        roleBIndex: pair.roleBIndex > removedRoleIndex ? pair.roleBIndex - 1 : pair.roleBIndex,
      }));
    setItem((current) => ({ ...current, additionalRoles: current.additionalRoles.filter((_, entryIndex) => entryIndex !== index), negotiationPairs: nextPairs }));
  }

  async function save() {
    setStatus("saving"); setError(""); setMessage("");
    const response = await fetch(`/api/admin/cases/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) setError(payload.error || "Не удалось сохранить кейс.");
    else { setMessage("Изменения сохранены. Комикс для опубликованного кейса поставлен на обновление."); router.refresh(); }
    setStatus("idle");
  }

  async function remove() {
    if (!window.confirm(`Безвозвратно удалить кейс «${item.title}» и его комиксы с озвучкой? История и результаты отыгрышей сохранятся.`)) return;
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
            <label><span>Обращение между участниками</span><select value={item.addressForm} onChange={(event) => set("addressForm", event.target.value as EditableCase["addressForm"])}><option value="formal">На «вы»</option><option value="informal">На «ты»</option></select></label>
            <label className="wide"><span>Краткое описание</span><textarea value={item.summary} onChange={(event) => set("summary", event.target.value)} /></label>
            <label className="wide"><span>Ситуация</span><textarea value={item.situation} onChange={(event) => set("situation", event.target.value)} /></label>
            <label className="wide"><span>Центральный конфликт</span><textarea value={item.conflict} onChange={(event) => set("conflict", event.target.value)} /></label>
            <label><span>Стартовая ситуация</span><textarea value={item.startSituation} onChange={(event) => set("startSituation", event.target.value)} /></label>
            <label><span>Почему кейс сложный</span><textarea value={item.difficultyReason} onChange={(event) => set("difficultyReason", event.target.value)} /></label>
            <label><span>Ставки — по одной на строке</span><textarea value={lines(item.stakes)} onChange={(event) => set("stakes", split(event.target.value))} /></label>
            <label><span>Критерии оценки — по одному на строке</span><textarea value={lines(item.evaluationFocus)} onChange={(event) => set("evaluationFocus", split(event.target.value))} /></label>
            <label><span>Сценарные условия — по одному на строке</span><textarea value={lines(item.scenarioConditions || [])} onChange={(event) => set("scenarioConditions", split(event.target.value))} /></label>
            <label><span>Условия решения — по одному на строке</span><textarea value={lines(item.decisionTerms || [])} onChange={(event) => set("decisionTerms", split(event.target.value))} /></label>
            <label><span>Границы полномочий — по одной на строке</span><textarea value={lines(item.authorityLimits || [])} onChange={(event) => set("authorityLimits", split(event.target.value))} /></label>
            <label><span>Опасные зоны — по одной на строке</span><textarea value={lines(item.riskZones || [])} onChange={(event) => set("riskZones", split(event.target.value))} /></label>
            <label><span>Ожидаемые следующие шаги — по одному на строке</span><textarea value={lines(item.expectedNextSteps || [])} onChange={(event) => set("expectedNextSteps", split(event.target.value))} /></label>
            <label className="wide"><span>Успешный итог диалога</span><textarea value={item.successOutcome || ""} onChange={(event) => set("successOutcome", event.target.value)} /></label>
            <label className="wide"><span>Методические пояснения</span><textarea value={item.methodologyNotes || ""} onChange={(event) => set("methodologyNotes", event.target.value)} /></label>
          </div>
        </article>

        <article className="admin-editor-section">
          <div className="admin-editor-section-title"><h2>Роли</h2>{item.additionalRoles.length < 2 && <button type="button" onClick={() => set("additionalRoles", [...item.additionalRoles, emptyRole()])}>＋ Добавить роль</button>}</div>
          <div className="admin-role-editor-list">
            <RoleEditor label="Роль 1" role={item.userRole} onChange={(role) => set("userRole", role)} />
            <RoleEditor label="Роль 2" role={item.opponentRole} onChange={(role) => set("opponentRole", role)} />
            {item.additionalRoles.map((role, index) => <RoleEditor key={index} label={`Дополнительная роль ${index + 1}`} role={role} onChange={(next) => setAdditional(index, next)} removable onRemove={() => removeAdditionalRole(index)} />)}
          </div>
          <div className="admin-pair-editor">
            <h3>Допустимые пары оппонентов</h3>
            <p>Включайте пару только тогда, когда у ролей есть прямой конфликт и предмет для отдельного разговора.</p>
            {roles.flatMap((roleA, roleAIndex) => roles.slice(roleAIndex + 1).map((roleB, offset) => {
              const roleBIndex = roleAIndex + offset + 1;
              const pair = pairFor(roleAIndex, roleBIndex);
              return <label key={`${roleAIndex}-${roleBIndex}`}><span><input type="checkbox" checked={Boolean(pair)} onChange={(event) => togglePair(roleAIndex, roleBIndex, event.target.checked)} /> {roleA.name || `Роль ${roleAIndex + 1}`} ↔ {roleB.name || `Роль ${roleBIndex + 1}`}</span>{pair && <textarea value={pair.reason} onChange={(event) => updatePairReason(roleAIndex, roleBIndex, event.target.value)} />}</label>;
            }))}
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
