"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CanonicalCase, CaseRole, CaseWorkspaceView } from "@/lib/case-types";
import CaseNegotiationPairs from "@/components/CaseNegotiationPairs";
import CaseCanonicalDetails from "@/components/CaseCanonicalDetails";
import { validateUploadSelection } from "@/lib/case-upload-constraints";
import CaseVisibilityPicker from "@/components/CaseVisibilityPicker";
import type { CaseVisibility } from "@/lib/case-visibility";
import { readJsonResponse } from "@/lib/http-response";
import { caseApprovalRedirectUrl } from "@/lib/case-approval-navigation";
import {
  emptyCaseGeneratorFields,
  formatCaseGeneratorFields,
  type CaseGeneratorFields,
  type CaseGeneratorRoleFields,
} from "@/lib/case-generator-fields";

type BuilderStatus = "idle" | "analyzing" | "revising" | "approving" | "error";
type TranscriptionPayload = { error?: string; text?: string };

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  return `${Math.round(bytes / 1024)} КБ`;
}

export function CaseVariantRoles({ roles }: { roles: CaseRole[] }) {
  return (
    <div className="variant-roles">
      {roles.map((role, index) => (
        <section key={`${role.name}-${index}`}>
          <span>РОЛЬ {index + 1}</span>
          <strong>{role.name}</strong>
          <small>{role.position}</small>
          <div className="variant-role-details">
            <b>Цель</b><p>{role.publicGoal}</p>
            <b>Интересы</b><ul>{role.interests.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul>
            <b>Ограничения</b><ul>{role.constraints.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul>
          </div>
        </section>
      ))}
    </div>
  );
}

export default function CaseBuilder() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [roleCount, setRoleCount] = useState("");
  const [caseFields, setCaseFields] = useState<CaseGeneratorFields>(emptyCaseGeneratorFields);
  const [files, setFiles] = useState<File[]>([]);
  const [workspace, setWorkspace] = useState<CaseWorkspaceView | null>(null);
  const [status, setStatus] = useState<BuilderStatus>("idle");
  const [error, setError] = useState("");
  const [visibility, setVisibility] = useState<CaseVisibility>("public");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceTarget, setVoiceTarget] = useState<string | null>(null);
  const [revisionDrafts, setRevisionDrafts] = useState<Record<string, string>>({});
  const [revisingVariantId, setRevisingVariantId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actionPendingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const statusBusy = status === "analyzing" || status === "revising" || status === "approving";
  const inputBusy = statusBusy || recording || transcribing;
  const visibleRoleCount = Number(roleCount) || 2;

  function setCaseField<K extends keyof Omit<CaseGeneratorFields, "roles">>(key: K, value: CaseGeneratorFields[K]) {
    setCaseFields((current) => ({ ...current, [key]: value }));
  }

  function setRoleField<K extends keyof CaseGeneratorRoleFields>(index: number, key: K, value: string) {
    setCaseFields((current) => ({
      ...current,
      roles: current.roles.map((role, roleIndex) => roleIndex === index ? { ...role, [key]: value } : role),
    }));
  }

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  useEffect(() => () => {
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onerror = null;
      recorderRef.current.onstop = null;
      if (recorderRef.current.state === "recording") recorderRef.current.stop();
    }
    releaseMicrophone();
  }, []);

  async function transcribeVoice(blob: Blob, target: string) {
    setTranscribing(true);
    setVoiceError("");
    try {
      const form = new FormData();
      const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", blob, `case-description.${extension}`);
      const response = await fetch("/api/case-builder/transcribe", { method: "POST", body: form });
      const { payload } = await readJsonResponse<TranscriptionPayload>(response);
      if (!response.ok || !payload?.text) {
        throw new Error(payload?.error || "Не удалось расшифровать запись.");
      }
      if (target === "notes") {
        setNotes((current) => [current.trim(), payload.text?.trim()].filter(Boolean).join("\n\n").slice(0, 20000));
      } else {
        setRevisionDrafts((current) => ({
          ...current,
          [target]: [current[target]?.trim(), payload.text?.trim()].filter(Boolean).join("\n\n").slice(0, 6000),
        }));
      }
    } catch (transcriptionError) {
      setVoiceError(transcriptionError instanceof Error ? transcriptionError.message : "Не удалось расшифровать запись.");
    } finally {
      setTranscribing(false);
      setVoiceTarget(null);
    }
  }

  async function startRecording(target: string) {
    setVoiceError("");
    setVoiceTarget(target);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Голосовой ввод не поддерживается этим браузером.");
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
        setVoiceError("Не удалось записать голосовое описание.");
        setRecording(false);
        setVoiceTarget(null);
        releaseMicrophone();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        setRecording(false);
        releaseMicrophone();
        if (blob.size) void transcribeVoice(blob, target);
        else setVoiceTarget(null);
      };
      recorder.start();
      setRecording(true);
    } catch (recordingError) {
      releaseMicrophone();
      setVoiceTarget(null);
      setVoiceError(recordingError instanceof Error ? recordingError.message : "Не удалось получить доступ к микрофону.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function analyze() {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setStatus("analyzing");
    setError("");
    try {
      const form = new FormData();
      if (workspace?.id) form.set("workspaceId", workspace.id);
      form.set("title", title || "Новый управленческий кейс");
      form.set("notes", [notes.trim(), formatCaseGeneratorFields(caseFields, visibleRoleCount)].filter(Boolean).join("\n\n"));
      form.set("roleCount", roleCount);
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
        body: JSON.stringify({ variantId, visibility }),
      });
      const payload = (await response.json()) as { case?: CanonicalCase; error?: string };
      if (!response.ok || !payload.case) throw new Error(payload.error || "Не удалось утвердить кейс.");
      window.location.assign(caseApprovalRedirectUrl(payload.case.id));
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось утвердить кейс.");
    } finally {
      actionPendingRef.current = false;
    }
  }

  async function revise(variantId: string) {
    if (actionPendingRef.current) return;
    const instructions = revisionDrafts[variantId]?.trim() || "";
    if (instructions.length < 3) {
      setStatus("error");
      setError("Опишите, что нужно изменить в выбранном варианте.");
      return;
    }
    actionPendingRef.current = true;
    setStatus("revising");
    setRevisingVariantId(variantId);
    setError("");
    try {
      const response = await fetch("/api/case-builder/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, instructions }),
      });
      const payload = (await response.json()) as { workspace?: CaseWorkspaceView; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error || "Не удалось исправить вариант кейса.");
      setWorkspace(payload.workspace);
      setRevisionDrafts({});
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось исправить вариант кейса.");
    } finally {
      setRevisingVariantId(null);
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
        <div><span className="admin-eyebrow">КОНСТРУКТОР УПРАВЛЕНЧЕСКИХ ПОЕДИНКОВ</span><h1>Создать свой кейс</h1><p>Добавьте документы и контекст. AI предложит конфликтные ситуации и роли по методике Тарасова. Выбранный сценарий можно уточнять текстом или голосом до одобрения.</p></div>
        <Link className="admin-primary-link" href="/">К ПЕРЕГОВОРАМ →</Link>
      </header>

      <section className="builder-input-card">
        <div className="builder-field-grid">
          <label><span>НАЗВАНИЕ РАБОЧЕГО ПРОЕКТА</span><input value={title} disabled={inputBusy} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Пересмотр условий контракта" maxLength={160} /></label>
          <label><span>КОЛИЧЕСТВО РОЛЕЙ</span><select value={roleCount} disabled={inputBusy} onChange={(event) => setRoleCount(event.target.value)}><option value="">Определить по описанию</option><option value="2">2 роли</option><option value="3">3 роли</option><option value="4">4 роли</option></select><small>При явном выборе AI обязан создать указанное число полноценных ролей.</small></label>
          <label className="builder-files"><span>МАТЕРИАЛЫ</span><input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.xml,.html,.htm,.rtf,.pdf,.docx" disabled={inputBusy} onChange={(event) => chooseFiles(Array.from(event.target.files || []))} /><small>До 6 файлов, общий размер черновика до 4 МБ: TXT, MD, CSV, JSON, XML, HTML, RTF, PDF, DOCX</small></label>
        </div>
        <div className="builder-notes">
          <label htmlFor="case-builder-notes">ОПИСАНИЕ И ДРУГИЕ ДЕТАЛИ</label>
          <div className="builder-notes-input">
            <textarea id="case-builder-notes" value={notes} disabled={inputBusy} onChange={(event) => setNotes(event.target.value)} placeholder="Опишите участников, историю отношений, ограничения, спорные вопросы, риски и желаемые роли. После первого анализа сюда можно добавить новый контекст и повторить генерацию." maxLength={20000} />
            <button
              className={`builder-notes-mic ${recording && voiceTarget === "notes" ? "recording" : ""}`}
              type="button"
              onClick={recording && voiceTarget === "notes" ? stopRecording : () => startRecording("notes")}
              disabled={statusBusy || transcribing || (recording && voiceTarget !== "notes")}
              aria-label={recording && voiceTarget === "notes" ? "Остановить голосовой ввод" : "Начать голосовой ввод"}
              aria-pressed={recording && voiceTarget === "notes"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6" /></svg>
              <span>{recording && voiceTarget === "notes" ? "ОСТАНОВИТЬ" : transcribing && voiceTarget === "notes" ? "РАСПОЗНАЁМ…" : "ГОЛОСОВОЙ ВВОД"}</span>
            </button>
          </div>
          {voiceError && <small className="builder-voice-error" role="alert">{voiceError}</small>}
        </div>

        <details className="builder-structured-case">
          <summary>Заполнить подробные поля кейса</summary>
          <p>Заполните только известные поля. Незаданные значения останутся пустыми и будут показаны в базе как «Не задано».</p>
          <div className="builder-structured-grid">
            <label><span>КРАТКОЕ ОПИСАНИЕ</span><textarea value={caseFields.summary} disabled={inputBusy} onChange={(event) => setCaseField("summary", event.target.value)} /></label>
            <label><span>СИТУАЦИЯ И КОНТЕКСТ</span><textarea value={caseFields.situation} disabled={inputBusy} onChange={(event) => setCaseField("situation", event.target.value)} /></label>
            <label><span>ЦЕНТРАЛЬНЫЙ КОНФЛИКТ</span><textarea value={caseFields.conflict} disabled={inputBusy} onChange={(event) => setCaseField("conflict", event.target.value)} /></label>
            <label><span>ФОРМА ОБРАЩЕНИЯ</span><select value={caseFields.addressForm} disabled={inputBusy} onChange={(event) => setCaseField("addressForm", event.target.value as CaseGeneratorFields["addressForm"])}><option value="">Не задано</option><option value="formal">На «вы»</option><option value="informal">На «ты»</option></select></label>
            <label><span>НАЧАЛЬНАЯ СИТУАЦИЯ</span><textarea value={caseFields.startSituation} disabled={inputBusy} onChange={(event) => setCaseField("startSituation", event.target.value)} /></label>
            <label><span>СТАВКИ — ПО ОДНОЙ НА СТРОКЕ</span><textarea value={caseFields.stakes} disabled={inputBusy} onChange={(event) => setCaseField("stakes", event.target.value)} /></label>
            <label><span>ПОЧЕМУ КЕЙС СЛОЖНЫЙ</span><textarea value={caseFields.difficultyReason} disabled={inputBusy} onChange={(event) => setCaseField("difficultyReason", event.target.value)} /></label>
            <label><span>ФОКУС ОЦЕНКИ — ПО ОДНОМУ НА СТРОКЕ</span><textarea value={caseFields.evaluationFocus} disabled={inputBusy} onChange={(event) => setCaseField("evaluationFocus", event.target.value)} /></label>
            <label><span>ПРЕДМЕТЫ ПЕРЕГОВОРОВ МЕЖДУ РОЛЯМИ</span><textarea value={caseFields.negotiationPairs} disabled={inputBusy} onChange={(event) => setCaseField("negotiationPairs", event.target.value)} /></label>
            <label><span>СЦЕНАРНЫЕ УСЛОВИЯ</span><textarea value={caseFields.scenarioConditions} disabled={inputBusy} onChange={(event) => setCaseField("scenarioConditions", event.target.value)} placeholder="Например: возразить не менее трёх раз; перебить участника ровно один раз" /></label>
            <label><span>УСЛОВИЯ РЕШЕНИЯ</span><textarea value={caseFields.decisionTerms} disabled={inputBusy} onChange={(event) => setCaseField("decisionTerms", event.target.value)} /></label>
            <label><span>ГРАНИЦЫ ПОЛНОМОЧИЙ</span><textarea value={caseFields.authorityLimits} disabled={inputBusy} onChange={(event) => setCaseField("authorityLimits", event.target.value)} /></label>
            <label><span>ОПАСНЫЕ ЗОНЫ</span><textarea value={caseFields.riskZones} disabled={inputBusy} onChange={(event) => setCaseField("riskZones", event.target.value)} /></label>
            <label><span>УСПЕШНЫЙ ИТОГ</span><textarea value={caseFields.successOutcome} disabled={inputBusy} onChange={(event) => setCaseField("successOutcome", event.target.value)} /></label>
            <label><span>ОЖИДАЕМЫЕ СЛЕДУЮЩИЕ ШАГИ</span><textarea value={caseFields.expectedNextSteps} disabled={inputBusy} onChange={(event) => setCaseField("expectedNextSteps", event.target.value)} /></label>
            <label><span>МЕТОДИЧЕСКИЕ ПОЯСНЕНИЯ</span><textarea value={caseFields.methodologyNotes} disabled={inputBusy} onChange={(event) => setCaseField("methodologyNotes", event.target.value)} /></label>
          </div>
          <div className="builder-role-fields">
            {caseFields.roles.slice(0, visibleRoleCount).map((role, index) => (
              <fieldset key={index}>
                <legend>РОЛЬ {index + 1}</legend>
                <div className="builder-structured-grid">
                  <label><span>ФИО</span><input value={role.name} disabled={inputBusy} onChange={(event) => setRoleField(index, "name", event.target.value)} /></label>
                  <label><span>ДОЛЖНОСТЬ</span><input value={role.position} disabled={inputBusy} onChange={(event) => setRoleField(index, "position", event.target.value)} /></label>
                  <label><span>ОТКРЫТАЯ ЦЕЛЬ</span><textarea value={role.publicGoal} disabled={inputBusy} onChange={(event) => setRoleField(index, "publicGoal", event.target.value)} /></label>
                  <label><span>ИНТЕРЕСЫ</span><textarea value={role.interests} disabled={inputBusy} onChange={(event) => setRoleField(index, "interests", event.target.value)} /></label>
                  <label><span>ОГРАНИЧЕНИЯ</span><textarea value={role.constraints} disabled={inputBusy} onChange={(event) => setRoleField(index, "constraints", event.target.value)} /></label>
                  <label><span>СКРЫТЫЕ МОТИВЫ</span><textarea value={role.hiddenMotives} disabled={inputBusy} onChange={(event) => setRoleField(index, "hiddenMotives", event.target.value)} /></label>
                  <label><span>РЕСУРСЫ ВЛИЯНИЯ</span><textarea value={role.leverage} disabled={inputBusy} onChange={(event) => setRoleField(index, "leverage", event.target.value)} /></label>
                  <label><span>ЗАДАЧА В РАЗГОВОРЕ</span><textarea value={role.roleBrief} disabled={inputBusy} onChange={(event) => setRoleField(index, "roleBrief", event.target.value)} /></label>
                  <label><span>СТАРТОВАЯ РЕПЛИКА</span><textarea value={role.openingLine} disabled={inputBusy} onChange={(event) => setRoleField(index, "openingLine", event.target.value)} /></label>
                  <label><span>ТИПОВЫЕ ВОЗРАЖЕНИЯ</span><textarea value={role.typicalObjections} disabled={inputBusy} onChange={(event) => setRoleField(index, "typicalObjections", event.target.value)} /></label>
                  <label><span>РЕКОМЕНДУЕМЫЕ ФОРМУЛИРОВКИ</span><textarea value={role.recommendedPhrases} disabled={inputBusy} onChange={(event) => setRoleField(index, "recommendedPhrases", event.target.value)} /></label>
                  <label><span>ЗАПРЕЩЁННЫЕ ФОРМУЛИРОВКИ</span><textarea value={role.forbiddenPhrases} disabled={inputBusy} onChange={(event) => setRoleField(index, "forbiddenPhrases", event.target.value)} /></label>
                </div>
              </fieldset>
            ))}
          </div>
        </details>

        {(files.length > 0 || workspace?.materials.length) && (
          <div className="material-list">
            {workspace?.materials.map((item) => <span key={item.id}>✓ {item.fileName} <small>{fileSize(item.sizeBytes)}</small></span>)}
            {files.map((file) => <span key={`${file.name}-${file.lastModified}`}>＋ {file.name} <small>{fileSize(file.size)}</small></span>)}
          </div>
        )}

        <button className="builder-analyze" onClick={analyze} disabled={inputBusy}>
          {status === "analyzing" ? <><i className="analysis-spinner" /> АНАЛИЗИРУЕМ МАТЕРИАЛЫ…</> : <>✦ ПРОАНАЛИЗИРОВАТЬ И ПРЕДЛОЖИТЬ ВАРИАНТЫ</>}
        </button>
        <p className="builder-method-note">Система проверяет, что интересы сторон действительно конфликтуют, ставки значимы, а очевидного решения, устраивающего всех, нет.</p>
        {error && <div className="error-banner"><strong>Не удалось продолжить</strong><span>{error}</span></div>}
      </section>

      {workspace?.variants.length ? (
        <section className="case-variants-section">
          <header><div><span className="admin-eyebrow">ПРЕДЛОЖЕННЫЕ СЦЕНАРИИ</span><h2>{workspace.variants.length === 1 ? "Проверьте исправленный вариант" : "Выберите управленческий поединок"}</h2></div><small>{workspace.variants.length === 1 ? "Одобрите кейс или снова уточните, что нужно изменить." : "Любой вариант можно уточнить текстом или голосом. После исправления останется только выбранный сценарий."}</small></header>
          <CaseVisibilityPicker value={visibility} onChange={setVisibility} disabled={status === "approving"} />
          <div className={`case-variant-grid ${workspace.variants.length === 1 ? "single" : ""}`}>
            {workspace.variants.map((variant) => (
              <article className="case-variant-card" key={variant.id}>
                <header><span>{variant.approvedAt ? "УТВЕРЖДЁН" : "ВАРИАНТ"}</span><h3>{variant.title}</h3><p>{variant.summary}</p></header>
                <div className="variant-conflict"><strong>ЦЕНТРАЛЬНЫЙ КОНФЛИКТ</strong><p>{variant.conflict}</p><small>{variant.difficultyReason}</small><small>Обращение: {variant.addressForm === "informal" ? "на «ты»" : "на «вы»"}</small></div>
                <CaseVariantRoles roles={[variant.userRole, variant.opponentRole, ...variant.additionalRoles]} />
                <CaseNegotiationPairs roles={[variant.userRole, variant.opponentRole, ...variant.additionalRoles]} pairs={variant.negotiationPairs} />
                <details><summary>Показать подробное описание</summary><CaseCanonicalDetails item={variant} /></details>
                {!variant.approvedAt && (
                  <div className="variant-revision">
                    <label htmlFor={`case-revision-${variant.id}`}>ЧТО ИЗМЕНИТЬ В ЭТОМ ВАРИАНТЕ</label>
                    <div>
                      <textarea
                        id={`case-revision-${variant.id}`}
                        value={revisionDrafts[variant.id] || ""}
                        onChange={(event) => setRevisionDrafts((current) => ({ ...current, [variant.id]: event.target.value }))}
                        disabled={statusBusy || recording || transcribing}
                        maxLength={6000}
                        placeholder="Например: измените название, уточните должность моей роли и добавьте интерес сохранить команду. Остальное оставьте без изменений."
                      />
                      <button
                        className={`variant-revision-mic ${recording && voiceTarget === variant.id ? "recording" : ""}`}
                        type="button"
                        onClick={recording && voiceTarget === variant.id ? stopRecording : () => startRecording(variant.id)}
                        disabled={statusBusy || transcribing || (recording && voiceTarget !== variant.id)}
                        aria-label={recording && voiceTarget === variant.id ? "Остановить голосовую корректировку" : "Записать корректировку голосом"}
                        aria-pressed={recording && voiceTarget === variant.id}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6" /></svg>
                        <span>{recording && voiceTarget === variant.id ? "ОСТАНОВИТЬ" : transcribing && voiceTarget === variant.id ? "РАСПОЗНАЁМ…" : "ГОЛОСОМ"}</span>
                      </button>
                    </div>
                    <button type="button" onClick={() => revise(variant.id)} disabled={statusBusy || recording || transcribing || !(revisionDrafts[variant.id]?.trim())}>
                      {status === "revising" && revisingVariantId === variant.id ? "ИСПРАВЛЯЕМ ВАРИАНТ…" : "ПРЕДЛОЖИТЬ ИСПРАВЛЕННУЮ ВЕРСИЮ"}
                    </button>
                  </div>
                )}
                <button className="variant-approve" onClick={() => approve(variant.id)} disabled={Boolean(variant.approvedAt) || statusBusy}>{variant.approvedAt ? "КЕЙС УЖЕ УТВЕРЖДЁН" : status === "approving" ? "ДОБАВЛЯЕМ… МЕДИА ПОЯВИТСЯ ПОЗЖЕ" : "ОДОБРИТЬ И ДОБАВИТЬ В БАЗУ"}</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
