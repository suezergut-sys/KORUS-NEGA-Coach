"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CanonicalCase, CaseWorkspaceView } from "@/lib/case-types";
import { validateUploadSelection } from "@/lib/case-upload-constraints";

type BuilderStatus = "idle" | "analyzing" | "approving" | "error";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  return `${Math.round(bytes / 1024)} КБ`;
}

export default function CaseBuilder() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [workspace, setWorkspace] = useState<CaseWorkspaceView | null>(null);
  const [status, setStatus] = useState<BuilderStatus>("idle");
  const [error, setError] = useState("");
  const [approvedCase, setApprovedCase] = useState<CanonicalCase | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actionPendingRef = useRef(false);

  async function analyze() {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setStatus("analyzing");
    setError("");
    setApprovedCase(null);
    try {
      const form = new FormData();
      if (workspace?.id) form.set("workspaceId", workspace.id);
      form.set("title", title || "Новый управленческий кейс");
      form.set("notes", notes);
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/case-builder/analyze", { method: "POST", body: form });
      const payload = (await response.json()) as { workspace?: CaseWorkspaceView; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error || "Не удалось получить варианты кейса.");
      setWorkspace(payload.workspace);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось проанализировать материалы.");
    } finally {
      actionPendingRef.current = false;
    }
  }

  async function approve(variantId: string) {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setStatus("approving");
    setError("");
    try {
      const response = await fetch("/api/case-builder/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId }),
      });
      const payload = (await response.json()) as { case?: CanonicalCase; error?: string };
      if (!response.ok || !payload.case) throw new Error(payload.error || "Не удалось утвердить кейс.");
      setApprovedCase(payload.case);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось утвердить кейс.");
    } finally {
      actionPendingRef.current = false;
    }
  }

  function chooseFiles(nextFiles: File[]) {
    try {
      validateUploadSelection(nextFiles, {
        count: workspace?.materials.length || 0,
        totalBytes: (workspace?.materials || []).reduce((sum, item) => sum + item.sizeBytes, 0),
      });
      setFiles(nextFiles);
      setError("");
    } catch (caught) {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Файлы не подходят для загрузки.");
    }
  }

  return (
    <>
      <header className="admin-page-header case-builder-header">
        <div><span className="admin-eyebrow">КОНСТРУКТОР УПРАВЛЕНЧЕСКИХ ПОЕДИНКОВ</span><h1>Создать свой кейс</h1><p>Добавьте документы и контекст. AI предложит конфликтные ситуации и роли по методике Тарасова.</p></div>
        <Link className="admin-primary-link" href="/">К ПЕРЕГОВОРАМ →</Link>
      </header>

      <section className="builder-input-card">
        <div className="builder-field-grid">
          <label><span>НАЗВАНИЕ РАБОЧЕГО ПРОЕКТА</span><input value={title} disabled={status === "analyzing" || status === "approving"} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Пересмотр условий контракта" maxLength={160} /></label>
          <label className="builder-files"><span>МАТЕРИАЛЫ</span><input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.xml,.html,.htm,.rtf,.pdf,.docx" disabled={status === "analyzing" || status === "approving"} onChange={(event) => chooseFiles(Array.from(event.target.files || []))} /><small>До 6 файлов, общий размер черновика до 4 МБ: TXT, MD, CSV, JSON, XML, HTML, RTF, PDF, DOCX</small></label>
        </div>
        <label className="builder-notes"><span>ОПИСАНИЕ И ДРУГИЕ ДЕТАЛИ</span><textarea value={notes} disabled={status === "analyzing" || status === "approving"} onChange={(event) => setNotes(event.target.value)} placeholder="Опишите участников, историю отношений, ограничения, спорные вопросы, риски и желаемые роли. После первого анализа сюда можно добавить новый контекст и повторить генерацию." maxLength={20000} /></label>

        {(files.length > 0 || workspace?.materials.length) && (
          <div className="material-list">
            {workspace?.materials.map((item) => <span key={item.id}>✓ {item.fileName} <small>{fileSize(item.sizeBytes)}</small></span>)}
            {files.map((file) => <span key={`${file.name}-${file.lastModified}`}>＋ {file.name} <small>{fileSize(file.size)}</small></span>)}
          </div>
        )}

        <button className="builder-analyze" onClick={analyze} disabled={status === "analyzing" || status === "approving"}>
          {status === "analyzing" ? <><i className="analysis-spinner" /> АНАЛИЗИРУЕМ МАТЕРИАЛЫ…</> : <>✦ ПРОАНАЛИЗИРОВАТЬ И ПРЕДЛОЖИТЬ ВАРИАНТЫ</>}
        </button>
        <p className="builder-method-note">Система проверяет, что интересы сторон действительно конфликтуют, ставки значимы, а очевидного решения, устраивающего всех, нет.</p>
        {error && <div className="error-banner"><strong>Не удалось продолжить</strong><span>{error}</span></div>}
      </section>

      {approvedCase && (
        <section className="case-approved-banner">
          <div><span>✓ КЕЙС ДОБАВЛЕН В БАЗУ</span><strong>{approvedCase.title}</strong><p>Он уже доступен в выпадающем списке тренажёра.</p></div>
          <Link href={`/?case=${approvedCase.id}`}>ВЫБРАТЬ И НАЧАТЬ ПЕРЕГОВОРЫ →</Link>
        </section>
      )}

      {workspace?.variants.length ? (
        <section className="case-variants-section">
          <header><div><span className="admin-eyebrow">ПРЕДЛОЖЕННЫЕ СЦЕНАРИИ</span><h2>Выберите управленческий поединок</h2></div><small>Можно дополнить описание выше и снова запустить анализ — новые варианты добавятся к списку.</small></header>
          <div className="case-variant-grid">
            {workspace.variants.map((variant) => (
              <article className="case-variant-card" key={variant.id}>
                <header><span>{variant.approvedAt ? "УТВЕРЖДЁН" : "ВАРИАНТ"}</span><h3>{variant.title}</h3><p>{variant.summary}</p></header>
                <div className="variant-conflict"><strong>ЦЕНТРАЛЬНЫЙ КОНФЛИКТ</strong><p>{variant.conflict}</p><small>{variant.difficultyReason}</small></div>
                <div className="variant-roles">
                  <section><span>ВАША РОЛЬ</span><strong>{variant.userRole.name}</strong><small>{variant.userRole.position}</small><p>{variant.userRole.publicGoal}</p><ul>{variant.userRole.interests.map((item) => <li key={item}>{item}</li>)}</ul></section>
                  <section><span>ОППОНЕНТ</span><strong>{variant.opponentRole.name}</strong><small>{variant.opponentRole.position}</small><p>{variant.opponentRole.publicGoal}</p><ul>{variant.opponentRole.interests.map((item) => <li key={item}>{item}</li>)}</ul></section>
                </div>
                <details><summary>Показать каноническое описание</summary><div><strong>Ситуация</strong><p>{variant.situation}</p><strong>Стартовая позиция</strong><p>{variant.startSituation}</p><strong>Ставки</strong><ul>{variant.stakes.map((item) => <li key={item}>{item}</li>)}</ul><strong>Методическая основа</strong><ul>{variant.methodologyBasis.map((item) => <li key={item.atomId}>{item.title}: {item.application}</li>)}</ul></div></details>
                <button onClick={() => approve(variant.id)} disabled={Boolean(variant.approvedAt) || status === "approving"}>{variant.approvedAt ? "КЕЙС УЖЕ УТВЕРЖДЁН" : status === "approving" ? "ДОБАВЛЯЕМ…" : "ОДОБРИТЬ И ДОБАВИТЬ В БАЗУ"}</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
