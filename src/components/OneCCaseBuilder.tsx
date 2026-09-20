"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CaseRole, GeneratedCaseVariant } from "@/lib/case-types";
import { caseApprovalRedirectUrl } from "@/lib/case-approval-navigation";
import { ONE_C_OBJECTION_OPTIONS, ONE_C_PROFILE_OPTIONS, ONE_C_REASON_OPTIONS } from "@/lib/one-c-case-input";
import { readJsonResponse } from "@/lib/http-response";

type Brief = {
  situation: string;
  reasons: string[];
  otherReason: string;
  profiles: string[];
  otherProfile: string;
  objections: string[];
  otherObjection: string;
  agreementFrame: string;
};

const EMPTY_BRIEF: Brief = { situation: "", reasons: [], otherReason: "", profiles: [], otherProfile: "", objections: [], otherObjection: "", agreementFrame: "" };
const listText = (items?: string[]) => (items || []).join("\n");
const textList = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 20);

function ChoiceMenu({ label, options, values, other, onValues, onOther }: {
  label: string; options: readonly string[]; values: string[]; other: string;
  onValues: (values: string[]) => void; onOther: (value: string) => void;
}) {
  const [showOther, setShowOther] = useState(Boolean(other));
  const toggle = (option: string) => onValues(values.includes(option) ? values.filter((item) => item !== option) : [...values, option]);
  return (
    <fieldset className="one-c-choice"><legend>{label}</legend><details><summary>{values.length ? `Выбрано: ${values.length}` : "Выберите варианты"}</summary><div>
      {options.map((option) => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} /> <span>{option}</span></label>)}
      <label><input type="checkbox" checked={showOther} onChange={(event) => { setShowOther(event.target.checked); if (!event.target.checked) onOther(""); }} /> <span>Другое</span></label>
      {showOther && <label className="one-c-other"><span>Свой вариант</span><input value={other} onChange={(event) => onOther(event.target.value)} placeholder="Введите свой вариант" maxLength={1000} /></label>}
    </div></details></fieldset>
  );
}

function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label><span>{label}</span><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ListField({ label, value, onChange }: { label: string; value?: string[]; onChange: (value: string[]) => void }) {
  return <TextField label={`${label} · по одному пункту на строке`} value={listText(value)} onChange={(text) => onChange(textList(text))} />;
}

function RoleEditor({ heading, role, onChange }: { heading: string; role: CaseRole; onChange: (role: CaseRole) => void }) {
  const set = <K extends keyof CaseRole>(key: K, value: CaseRole[K]) => onChange({ ...role, [key]: value });
  return <section className="one-c-role-editor"><h3>{heading}</h3><div className="one-c-edit-grid">
    <label><span>ФИО</span><input value={role.name} onChange={(event) => set("name", event.target.value)} /></label>
    <label><span>Должность</span><input value={role.position} onChange={(event) => set("position", event.target.value)} /></label>
    <label><span>Голос</span><select value={role.voiceGender} onChange={(event) => set("voiceGender", event.target.value as CaseRole["voiceGender"])}><option value="female">Женский</option><option value="male">Мужской</option></select></label>
    <TextField label="Открытая цель" value={role.publicGoal} onChange={(value) => set("publicGoal", value)} />
    <ListField label="Интересы" value={role.interests} onChange={(value) => set("interests", value)} />
    <ListField label="Ограничения" value={role.constraints} onChange={(value) => set("constraints", value)} />
    <ListField label="Скрытые мотивы" value={role.hiddenMotives} onChange={(value) => set("hiddenMotives", value)} />
    <ListField label="Ресурсы влияния" value={role.leverage} onChange={(value) => set("leverage", value)} />
    <TextField label="Задача в разговоре" value={role.roleBrief || ""} onChange={(value) => set("roleBrief", value)} />
    <TextField label="Стартовая реплика" value={role.openingLine || ""} onChange={(value) => set("openingLine", value)} />
    <ListField label="Типовые возражения" value={role.typicalObjections} onChange={(value) => set("typicalObjections", value)} />
    <ListField label="Рекомендуемые формулировки" value={role.recommendedPhrases} onChange={(value) => set("recommendedPhrases", value)} />
    <ListField label="Запрещённые формулировки" value={role.forbiddenPhrases} onChange={(value) => set("forbiddenPhrases", value)} />
  </div></section>;
}

export default function OneCCaseBuilder() {
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [generated, setGenerated] = useState<GeneratedCaseVariant | null>(null);
  const [busy, setBusy] = useState<"generate" | "publish" | "transcribe" | null>(null);
  const [error, setError] = useState("");
  const [recordingTarget, setRecordingTarget] = useState<"situation" | "agreementFrame" | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const setBriefField = <K extends keyof Brief>(key: K, value: Brief[K]) => setBrief((current) => ({ ...current, [key]: value }));
  const setCase = <K extends keyof GeneratedCaseVariant>(key: K, value: GeneratedCaseVariant[K]) => setGenerated((current) => current ? { ...current, [key]: value } : current);

  async function transcribe(blob: Blob, target: "situation" | "agreementFrame") {
    setBusy("transcribe");
    try {
      const form = new FormData();
      form.append("audio", blob, "one-c-case.webm");
      const response = await fetch("/api/case-builder/transcribe", { method: "POST", body: form });
      const { payload } = await readJsonResponse<{ text?: string; error?: string }>(response);
      if (!response.ok || !payload?.text) throw new Error(payload?.error || "Не удалось распознать запись.");
      setBrief((current) => ({ ...current, [target]: [current[target].trim(), payload.text?.trim()].filter(Boolean).join("\n\n") }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось распознать запись."); }
    finally { setBusy(null); setRecordingTarget(null); }
  }

  async function toggleRecording(target: "situation" | "agreementFrame") {
    if (recordingTarget === target && recorderRef.current?.state === "recording") { recorderRef.current.stop(); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecordingTarget(null);
        if (blob.size) void transcribe(blob, target);
      };
      recorder.start();
      setRecordingTarget(target);
    } catch { setError("Не удалось получить доступ к микрофону."); }
  }

  async function generate() {
    setBusy("generate"); setError("");
    try {
      const response = await fetch("/api/one-c-cases/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief) });
      const payload = await response.json() as { case?: GeneratedCaseVariant; error?: string };
      if (!response.ok || !payload.case) throw new Error(payload.error || "Не удалось сформировать кейс.");
      setGenerated(payload.case);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось сформировать кейс."); }
    finally { setBusy(null); }
  }

  async function publish() {
    if (!generated) return;
    setBusy("publish"); setError("");
    try {
      const response = await fetch("/api/one-c-cases/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(generated) });
      const payload = await response.json() as { case?: { id: string }; error?: string };
      if (!response.ok || !payload.case) throw new Error(payload.error || "Не удалось опубликовать кейс.");
      window.location.assign(caseApprovalRedirectUrl(payload.case.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось опубликовать кейс."); setBusy(null); }
  }

  const voiceButton = (target: "situation" | "agreementFrame") => <button type="button" className={`one-c-voice ${recordingTarget === target ? "recording" : ""}`} disabled={Boolean(busy) || (recordingTarget !== null && recordingTarget !== target)} onClick={() => toggleRecording(target)}>{recordingTarget === target ? "■ Остановить" : busy === "transcribe" ? "Распознаём…" : "● Наговорить голосом"}</button>;

  return <>
    <header className="admin-page-header case-builder-header"><div><span className="admin-eyebrow">ТОЛЬКО ДЛЯ СОТРУДНИКОВ 1С</span><h1>Создать кейс 1С</h1><p>Опишите разговор об увольнении, задайте поведение сотрудника и рамку соглашения. Кейс будет виден только вам.</p></div><Link className="admin-primary-link" href="/case-library">К БАЗЕ КЕЙСОВ →</Link></header>
    <main className="one-c-builder">
      <section className="builder-input-card"><div className="one-c-step"><b>1</b><h2>Опишите ситуацию</h2></div><div className="builder-notes-input"><textarea value={brief.situation} onChange={(event) => setBriefField("situation", event.target.value)} maxLength={12000} placeholder="Например: нужно поговорить с сотрудником на испытательном сроке…" />{voiceButton("situation")}</div></section>
      <section className="builder-input-card"><div className="one-c-step"><b>2</b><h2>Соберите сценарий</h2></div><div className="one-c-choice-grid">
        <ChoiceMenu label="Основная причина" options={ONE_C_REASON_OPTIONS} values={brief.reasons} other={brief.otherReason} onValues={(value) => setBriefField("reasons", value)} onOther={(value) => setBriefField("otherReason", value)} />
        <ChoiceMenu label="Поведенческий профиль сотрудника" options={ONE_C_PROFILE_OPTIONS} values={brief.profiles} other={brief.otherProfile} onValues={(value) => setBriefField("profiles", value)} onOther={(value) => setBriefField("otherProfile", value)} />
        <ChoiceMenu label="Ограничения и возражения" options={ONE_C_OBJECTION_OPTIONS} values={brief.objections} other={brief.otherObjection} onValues={(value) => setBriefField("objections", value)} onOther={(value) => setBriefField("otherObjection", value)} />
      </div><div className="builder-notes"><label>РАМКА СОГЛАШЕНИЯ: ЧТО МОЖНО ПРЕДЛАГАТЬ И ЧТО НЕЛЬЗЯ ОБЕЩАТЬ</label><div className="builder-notes-input"><textarea value={brief.agreementFrame} onChange={(event) => setBriefField("agreementFrame", event.target.value)} maxLength={6000} placeholder="Например: можно предложить один оклад и HR-сопровождение; нельзя обещать продление испытательного срока…" />{voiceButton("agreementFrame")}</div></div>
      <button className="one-c-primary" type="button" disabled={Boolean(busy) || recordingTarget !== null} onClick={generate}>{busy === "generate" ? "ГЕНЕРИРУЕМ…" : generated ? "СГЕНЕРИРОВАТЬ ЗАНОВО" : "СГЕНЕРИРОВАТЬ КЕЙС"}</button></section>

      {generated && <section className="builder-input-card one-c-generated"><div className="one-c-step"><b>3</b><div><h2>Проверьте и отредактируйте кейс</h2><p>Методология «1С:Увольнение», роль руководителя и первая реплика руководителя будут закреплены автоматически.</p></div></div><div className="one-c-edit-grid">
        <label><span>Название</span><input value={generated.title} onChange={(event) => setCase("title", event.target.value)} /></label>
        <TextField label="Краткое описание" value={generated.summary} onChange={(value) => setCase("summary", value)} />
        <TextField label="Ситуация и контекст" value={generated.situation} onChange={(value) => setCase("situation", value)} rows={6} />
        <TextField label="Центральный конфликт" value={generated.conflict} onChange={(value) => setCase("conflict", value)} />
        <label><span>Форма обращения</span><select value={generated.addressForm} onChange={(event) => setCase("addressForm", event.target.value as GeneratedCaseVariant["addressForm"])}><option value="informal">На «ты»</option><option value="formal">На «вы»</option></select></label>
        <TextField label="Начальная ситуация" value={generated.startSituation} onChange={(value) => setCase("startSituation", value)} />
        <ListField label="Ставки" value={generated.stakes} onChange={(value) => setCase("stakes", value)} />
        <TextField label="Почему кейс сложный" value={generated.difficultyReason} onChange={(value) => setCase("difficultyReason", value)} />
        <ListField label="Фокус оценки" value={generated.evaluationFocus} onChange={(value) => setCase("evaluationFocus", value)} />
        <TextField label="Предмет переговоров руководителя и сотрудника" value={generated.negotiationPairs[0]?.reason || ""} onChange={(value) => setCase("negotiationPairs", [{ roleAIndex: 0, roleBIndex: 1, reason: value }])} />
        <ListField label="Сценарные условия" value={generated.scenarioConditions} onChange={(value) => setCase("scenarioConditions", value)} />
        <ListField label="Условия решения" value={generated.decisionTerms} onChange={(value) => setCase("decisionTerms", value)} />
        <ListField label="Границы полномочий" value={generated.authorityLimits} onChange={(value) => setCase("authorityLimits", value)} />
        <ListField label="Опасные зоны" value={generated.riskZones} onChange={(value) => setCase("riskZones", value)} />
        <TextField label="Успешный итог" value={generated.successOutcome || ""} onChange={(value) => setCase("successOutcome", value)} />
        <ListField label="Ожидаемые следующие шаги" value={generated.expectedNextSteps} onChange={(value) => setCase("expectedNextSteps", value)} />
        <TextField label="Методические пояснения" value={generated.methodologyNotes || ""} onChange={(value) => setCase("methodologyNotes", value)} />
      </div><RoleEditor heading="Роль 1 · Руководитель (играет пользователь)" role={generated.userRole} onChange={(value) => setCase("userRole", value)} /><RoleEditor heading="Роль 2 · Сотрудник (играет AI)" role={generated.opponentRole} onChange={(value) => setCase("opponentRole", value)} />
      <div className="one-c-publish"><div><strong>🔒 Приватный кейс</strong><span>После публикации он будет доступен только вам.</span></div><button className="one-c-primary" type="button" disabled={Boolean(busy)} onClick={publish}>{busy === "publish" ? "ПУБЛИКУЕМ…" : "ОПУБЛИКОВАТЬ"}</button></div></section>}
      {error && <p className="builder-error" role="alert">{error}</p>}
    </main>
  </>;
}
