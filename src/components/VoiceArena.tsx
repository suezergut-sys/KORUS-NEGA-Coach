"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NegotiationAnalysis } from "@/lib/analysis-types";
import type { CanonicalCase } from "@/lib/case-types";

type Status = "idle" | "connecting" | "connected" | "error";
type Speaker = "Вы" | "Оппонент" | "Система";
type Line = { id: string; author: Speaker; text: string; time: string };
type VoiceMode = "female" | "male";
type AnalysisStatus = "idle" | "loading" | "ready" | "error";
type RoleSide = "user" | "opponent";

const CASE_CONTEXT =
  "Компания «Альтаир» внедряет новую CRM. Ключевой этап проекта сорван, а заказчик требует назвать ответственного и компенсировать задержку.";
const CASE_GOAL =
  "Сохранить рабочие отношения, добиться признания ответственности и согласовать реалистичный план исправления ситуации.";
const CASE_CONSTRAINTS = [
  "Нельзя перекладывать ответственность на заказчика",
  "Срок восстановления — не более 10 рабочих дней",
  "Ключевого сотрудника желательно сохранить",
];

const DEFAULT_CASE: CanonicalCase = {
  id: "default-missed-project-deadline",
  slug: "missed-project-deadline",
  title: "Сорванный срок проекта",
  summary: "Разговор руководителя проекта с сильным сотрудником после срыва ключевого этапа внедрения CRM.",
  situation: CASE_CONTEXT,
  conflict: "Нужно восстановить управляемость и добиться принятия ответственности, не потеряв ключевого специалиста и не усилив срыв проекта.",
  userRole: {
    name: "Руководитель проекта",
    position: "Руководитель проекта",
    publicGoal: CASE_GOAL,
    interests: ["Восстановить срок проекта", "Сохранить доверие заказчика", "Не потерять ключевого специалиста"],
    constraints: CASE_CONSTRAINTS,
    hiddenMotives: [],
    leverage: ["Распределение ресурсов проекта", "Оценка результатов сотрудника"],
  },
  opponentRole: {
    name: "Алексей, руководитель отдела продаж",
    position: "Ключевой участник проекта",
    publicGoal: "Избежать персонального обвинения и сохранить влияние на решения по внедрению.",
    interests: ["Сохранить репутацию", "Получить дополнительные ресурсы", "Не принимать нереалистичный срок"],
    constraints: ["Не готов единолично отвечать за системный сбой"],
    hiddenMotives: ["Опасается ослабления своей позиции в компании"],
    leverage: ["Уникальная экспертиза", "Поддержка части команды"],
  },
  stakes: ["Отношения с заказчиком", "Срок внедрения", "Репутация участников"],
  startSituation: "Оппонент начинает с отрицания личной ответственности и требует признать системный характер проблемы.",
  difficultyReason: "Распределение ответственности, ресурсов и репутационных потерь не допускает очевидного взаимовыгодного решения.",
  evaluationFocus: ["Управление позицией", "Выяснение интересов", "Работа с ответственностью"],
  methodologyBasis: [],
  origin: "seed",
};

const OPPONENTS = {
  female: {
    name: "Марина Волкова",
    title: "Директор по закупкам",
    voice: "marin",
    image: "/opponents/opponent-female.png",
    style: "Рациональна, внимательна к рискам, ценит конкретику",
  },
  male: {
    name: "Алексей Крылов",
    title: "Директор по закупкам",
    voice: "cedar",
    image: "/opponents/opponent-male.png",
    style: "Сдержан, требователен к фактам, защищает условия сделки",
  },
} as const;

const WAVE_BARS = [22, 32, 18, 42, 29, 58, 35, 72, 43, 88, 52, 66, 36, 79, 46, 61, 28, 49, 33, 24];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clockTime() {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

export default function VoiceArena() {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("female");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [eventCount, setEventCount] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState<NegotiationAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [cases, setCases] = useState<CanonicalCase[]>([DEFAULT_CASE]);
  const [selectedCaseId, setSelectedCaseId] = useState(DEFAULT_CASE.id);
  const [selectedRoleSide, setSelectedRoleSide] = useState<RoleSide>("user");
  const [casesError, setCasesError] = useState("");
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [quickStatus, setQuickStatus] = useState<"idle" | "loading" | "error">("idle");
  const [quickError, setQuickError] = useState("");

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const responseStartedAtRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const analysisRef = useRef<HTMLElement | null>(null);
  const startedAtRef = useRef<string | null>(null);

  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0] || DEFAULT_CASE;
  const participantRole = selectedRoleSide === "user" ? selectedCase.userRole : selectedCase.opponentRole;
  const aiRole = selectedRoleSide === "user" ? selectedCase.opponentRole : selectedCase.userRole;
  const voiceProfile = OPPONENTS[voiceMode];
  const opponent = {
    ...voiceProfile,
    name: aiRole.name,
    title: aiRole.position,
  };
  const selectedCaseContext = `${selectedCase.situation}\n\nЦентральный конфликт: ${selectedCase.conflict}`;
  const isLive = status === "connected";
  const isBusy = status === "connecting";

  const loadCases = useCallback(async (preferredId?: string) => {
    try {
      const response = await fetch("/api/cases", { cache: "no-store" });
      const payload = (await response.json()) as { cases?: CanonicalCase[]; error?: string };
      if (!response.ok || !payload.cases?.length) throw new Error(payload.error || "База кейсов пока недоступна.");
      setCases(payload.cases);
      const queryId = preferredId || new URLSearchParams(window.location.search).get("case") || "";
      setSelectedCaseId(payload.cases.some((item) => item.id === queryId) ? queryId : payload.cases[0].id);
      if (preferredId) setSelectedRoleSide("user");
      setCasesError("");
    } catch (caught) {
      setCasesError(caught instanceof Error ? caught.message : "Не удалось загрузить кейсы.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCases(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCases]);

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  useEffect(() => {
    if (analysisStatus === "ready") analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [analysisStatus]);

  function chooseCase(caseId: string) {
    if (isLive || isBusy) return;
    setSelectedCaseId(caseId);
    setSelectedRoleSide("user");
    setLines([]);
    setAnalysis(null);
    setAnalysisStatus("idle");
    const url = new URL(window.location.href);
    url.searchParams.set("case", caseId);
    window.history.replaceState(null, "", url);
  }

  function chooseRole(side: RoleSide) {
    if (isLive || isBusy) return;
    setSelectedRoleSide(side);
    setLines([]);
    setAnalysis(null);
    setAnalysisStatus("idle");
  }

  async function uploadQuickCase() {
    if (!quickFile || quickStatus === "loading") return;
    setQuickStatus("loading");
    setQuickError("");
    try {
      const form = new FormData();
      form.set("file", quickFile);
      const response = await fetch("/api/cases/quick-upload", { method: "POST", body: form });
      const payload = (await response.json()) as { case?: CanonicalCase; error?: string };
      if (!response.ok || !payload.case) throw new Error(payload.error || "Не удалось подготовить кейс.");
      await loadCases(payload.case.id);
      setQuickStatus("idle");
      setQuickFile(null);
      setQuickUploadOpen(false);
      setLines([{ id: crypto.randomUUID(), author: "Система", text: `Кейс «${payload.case.title}» добавлен в базу и выбран.`, time: clockTime() }]);
    } catch (caught) {
      setQuickStatus("error");
      setQuickError(caught instanceof Error ? caught.message : "Не удалось загрузить кейс.");
    }
  }

  const closeSession = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    setUserSpeaking(false);
    setOpponentSpeaking(false);
    setStatus("idle");
  }, []);

  useEffect(() => () => closeSession(), [closeSession]);

  const replaceLine = useCallback((author: Speaker, text: string, id: string) => {
    if (!text.trim()) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      const line = { id, author, text: text.trim(), time: clockTime() };
      if (existing === -1) return [...current, line].slice(-30);
      const next = [...current];
      next[existing] = { ...next[existing], text: text.trim() };
      return next;
    });
  }, []);

  const appendDelta = useCallback((author: Speaker, delta: string, id: string) => {
    if (!delta) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      if (existing === -1) {
        return [...current, { id, author, text: delta, time: clockTime() }].slice(-30);
      }
      const next = [...current];
      next[existing] = { ...next[existing], text: `${next[existing].text}${delta}` };
      return next;
    });
  }, []);

  const handleEvent = useCallback((raw: MessageEvent<string>) => {
    try {
      const event = JSON.parse(raw.data) as Record<string, unknown>;
      const type = String(event.type || "");
      const itemId = String(event.item_id || event.response_id || crypto.randomUUID());
      setEventCount((value) => value + 1);

      if (type === "input_audio_buffer.speech_started") setUserSpeaking(true);
      if (type === "input_audio_buffer.speech_stopped") {
        setUserSpeaking(false);
        responseStartedAtRef.current = performance.now();
      }
      if (type === "response.output_audio.delta" || type === "response.output_audio_transcript.delta") {
        setOpponentSpeaking(true);
        if (responseStartedAtRef.current) {
          setLatency(Math.round(performance.now() - responseStartedAtRef.current));
          responseStartedAtRef.current = null;
        }
      }
      if (type === "response.output_audio.done" || type === "response.output_audio_transcript.done") {
        setOpponentSpeaking(false);
      }
      if (type === "conversation.item.input_audio_transcription.delta") {
        appendDelta("Вы", String(event.delta || ""), itemId);
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        replaceLine("Вы", String(event.transcript || ""), itemId);
      }
      if (type === "response.output_audio_transcript.delta") {
        appendDelta("Оппонент", String(event.delta || ""), itemId);
      }
      if (type === "response.output_audio_transcript.done") {
        replaceLine("Оппонент", String(event.transcript || ""), itemId);
      }
      if (type === "error") {
        const nested = event.error as { message?: string } | undefined;
        setError(nested?.message || "Ошибка голосовой Realtime-сессии.");
      }
    } catch {
      // Диагностические сообщения вне JSON не влияют на голосовую сессию.
    }
  }, [appendDelta, replaceLine]);

  async function startSession() {
    if (isBusy || isLive) return;
    setStatus("connecting");
    setError("");
    setSeconds(0);
    setEventCount(0);
    setLatency(null);
    setAnalysisStatus("idle");
    setAnalysis(null);
    setAnalysisError("");
    startedAtRef.current = new Date().toISOString();
    setLines([{ id: "connecting", author: "Система", text: "Устанавливаем защищённую голосовую связь…", time: clockTime() }]);

    try {
      const health = await fetch("/api/realtime/session", { cache: "no-store" });
      if (!health.ok) throw new Error("На сервере не настроен OpenAI API key.");

      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => undefined);
      };

      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = media;
      media.getTracks().forEach((track) => pc.addTrack(track, media));

      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("message", handleEvent);
      channel.addEventListener("open", () => {
        setStatus("connected");
        setLines([{ id: "ready", author: "Система", text: `Связь установлена. ${opponent.name} начинает переговоры.`, time: clockTime() }]);
        channel.send(JSON.stringify({ type: "response.create" }));
      });
      channel.addEventListener("close", () => setStatus("idle"));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const params = new URLSearchParams({
        role: `${opponent.name}, ${opponent.title}`,
        difficulty: "Средняя",
        context: selectedCaseContext,
        caseId: selectedCase.id,
        participantRoleSide: selectedRoleSide,
        voice: opponent.voice,
      });
      const response = await fetch(`/api/realtime/session?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Не удалось открыть голосовую сессию.");
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (caught) {
      closeSession();
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось запустить микрофон.");
      setLines([]);
    }
  }

  async function endSession() {
    if (!isLive) return;
    const completedLines = [
      ...lines,
      { id: crypto.randomUUID(), author: "Система" as const, text: "Переговоры завершены пользователем.", time: clockTime() },
    ];
    setLines(completedLines);
    closeSession();
    setAnalysisStatus("loading");
    setAnalysisError("");

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id === DEFAULT_CASE.id ? undefined : selectedCase.id,
          caseCode: selectedCase.slug,
          caseContext: selectedCaseContext,
          caseGoal: participantRole.publicGoal,
          caseConstraints: participantRole.constraints,
          opponentName: opponent.name,
          opponentVoice: opponent.voice,
          startedAt: startedAtRef.current,
          durationSeconds: seconds,
          turns: completedLines,
        }),
      });
      const payload = (await response.json()) as { analysis?: NegotiationAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Не удалось получить оценку.");
      setAnalysis(payload.analysis);
      setAnalysisStatus("ready");
    } catch (caught) {
      setAnalysisStatus("error");
      setAnalysisError(caught instanceof Error ? caught.message : "Не удалось выполнить анализ.");
    }
  }

  return (
    <main className="duel-app">
      <aside className="nav-rail" aria-label="Разделы приложения">
        <div className="duel-symbol" aria-hidden="true">D</div>
        <Link className="rail-button active" href="/" aria-label="Домой" title="Домой">⌂</Link>
        <Link className="rail-button admin-rail-link" href="/admin" aria-label="Админ-панель" title="Админ-панель">⚙</Link>
        <button className="rail-button case-upload-rail" onClick={() => setQuickUploadOpen(true)} disabled={isLive || isBusy} aria-label="Загрузить кейс" title="Загрузить кейс">↑</button>
        <Link className="rail-button case-create-rail" href="/cases" aria-label="Создать свой кейс" title="Создать свой кейс">＋</Link>
      </aside>

      <aside className="settings-panel neon-panel">
        <header className="settings-header">
          <div className="brand-lockup"><strong>DUEL</strong><span>ТРЕНАЖЁР ПЕРЕГОВОРОВ</span></div>
          <span className="prototype-badge">ПРОТОТИП</span>
        </header>
        <h2><span>⚙</span> НАСТРОЙКИ</h2>

        <CaseSelect cases={cases} value={selectedCase.id} onChange={chooseCase} disabled={isLive || isBusy} />
        <RoleSelect selectedCase={selectedCase} value={selectedRoleSide} onChange={chooseRole} disabled={isLive || isBusy} />
        {casesError && <p className="case-select-error">{casesError}</p>}

        <section className="setting-group is-disabled">
          <div className="setting-label">УРОВЕНЬ СЛОЖНОСТИ <i>i</i></div>
          <div className="difficulty-track"><span /><b /></div>
          <div className="difficulty-labels"><span>Низкий</span><span>Средний</span><span>Высокий</span><span>Эксперт</span></div>
        </section>

        <section className="setting-group">
          <div className="setting-label">ГОЛОС ОППОНЕНТА <i>i</i></div>
          <div className="voice-switch" role="group" aria-label="Голос оппонента">
            <button
              className={voiceMode === "female" ? "selected" : ""}
              onClick={() => setVoiceMode("female")}
              disabled={isLive || isBusy}
              aria-pressed={voiceMode === "female"}
            >
              <strong>♀</strong><span>Женский голос</span><small>Marin</small>
            </button>
            <button
              className={voiceMode === "male" ? "selected" : ""}
              onClick={() => setVoiceMode("male")}
              disabled={isLive || isBusy}
              aria-pressed={voiceMode === "male"}
            >
              <strong>♂</strong><span>Мужской голос</span><small>Cedar</small>
            </button>
          </div>
        </section>

        <DisabledSelect label="СТИЛЬ ПЕРЕГОВОРОВ" value="Сотрудничество" icon="♞" />

        <section className="setting-group is-disabled">
          <div className="setting-label setting-row"><span>ТАЙМЕР <i>i</i></span><span className="fake-toggle on" /></div>
          <div className="timer-options"><button disabled>10 мин</button><button className="selected" disabled>20 мин</button><button disabled>30 мин</button><button disabled>45 мин</button></div>
        </section>

        <section className="setting-group extras">
          <div className="setting-label">ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ <i>i</i></div>
          <div className="is-disabled"><span>Показывать подсказки</span><span className="fake-toggle" /></div>
          <div><span>Анализ по методике после завершения</span><span className="fake-toggle on" /></div>
        </section>

        <button className="reset-settings" disabled>↻ &nbsp; СБРОСИТЬ НАСТРОЙКИ</button>
      </aside>

      <section className="conversation-panel neon-panel" aria-label="Переговоры">
        <header className="conversation-header">
          <div>
            <h1><span className="equalizer-icon">▥</span> ПЕРЕГОВОРЫ</h1>
            <p>Общайтесь с виртуальным оппонентом. Реплики появляются здесь в реальном времени.</p>
          </div>
          <div className="live-status">
            <span className={isLive ? "status-dot live" : "status-dot"} />
            <span>{isBusy ? "ПОДКЛЮЧЕНИЕ" : isLive ? "В ЭФИРЕ" : "ГОТОВ"}</span>
            <strong>{formatTime(seconds)}</strong>
          </div>
        </header>

        <div className="dialogue-surface">
          <div className="day-chip">Сегодня</div>
          {lines.length === 0 ? (
            <div className="empty-dialogue">
              <div className="empty-rings"><span>◉</span></div>
              <h3>Переговоры ещё не начались</h3>
              <p>Выберите голос оппонента и нажмите «Начать переговоры».</p>
            </div>
          ) : (
            <div className="dialogue-list" aria-live="polite">
              {lines.map((line) => (
                <article key={line.id} className={`message ${line.author === "Вы" ? "message-user" : line.author === "Система" ? "message-system" : "message-opponent"}`}>
                  {line.author === "Оппонент" && <Image className="message-avatar" src={opponent.image} alt="" width={46} height={46} />}
                  <div className="message-bubble">
                    <div className="message-meta"><strong>{line.author === "Оппонент" ? opponent.name : line.author}</strong><span>{line.time}</span></div>
                    <p>{line.text}</p>
                  </div>
                  {line.author === "Вы" && <div className="user-icon">●</div>}
                </article>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}

          <div className={`audio-deck ${isLive ? "active" : ""}`}>
            <div className="listening-copy"><span className={userSpeaking ? "mini-wave active" : "mini-wave"}>▥</span><small>{userSpeaking ? "Вы говорите…" : opponentSpeaking ? "Оппонент отвечает…" : isLive ? "Слушаю…" : "Ожидание"}</small></div>
            <div className="waveform" aria-hidden="true">
              {WAVE_BARS.map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * -55}ms` }} />)}
            </div>
            <div className={`mic-orb ${userSpeaking ? "speaking" : ""}`}>◉</div>
          </div>
          <p className="speech-note">ⓘ Говорите естественно. Система распознает речь и отобразит её в диалоге.</p>
        </div>

        {error && <div className="error-banner" role="alert"><strong>Не удалось начать переговоры.</strong><span>{error}</span></div>}

        {analysisStatus !== "idle" && (
          <section className="analysis-card" aria-live="polite" ref={analysisRef}>
            {analysisStatus === "loading" && (
              <div className="analysis-loading"><span className="analysis-spinner" /><div><strong>АНАЛИЗИРУЕМ ПОЕДИНОК</strong><p>Ищем релевантные фрагменты книги и сопоставляем их со стенограммой…</p></div></div>
            )}
            {analysisStatus === "error" && (
              <div className="analysis-error"><strong>Анализ пока недоступен</strong><p>{analysisError}</p></div>
            )}
            {analysisStatus === "ready" && analysis && (
              <>
                <header className="analysis-header">
                  <div><span>ИТОГОВЫЙ ОТЧЁТ ПО ПОЕДИНКУ</span><h2>{analysis.summary}</h2></div>
                  <div className="analysis-score"><strong>{analysis.overallScore}</strong><small>/ 100</small></div>
                </header>
                <p className="analysis-disclaimer">{analysis.disclaimer}</p>
                <section className={`duel-outcome ${analysis.outcome.winner}`}>
                  <div className="outcome-symbol">{analysis.outcome.winner === "user" ? "★" : analysis.outcome.winner === "opponent" ? "◆" : "="}</div>
                  <div><span>РЕЗУЛЬТАТ ПОЕДИНКА</span><h3>{analysis.outcome.winner === "user" ? "Победил участник" : analysis.outcome.winner === "opponent" ? `Победил оппонент — ${opponent.name}` : "Ничья — явного победителя нет"}</h3><p>{analysis.outcome.verdict}</p><ul>{analysis.outcome.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>
                </section>

                <section className="personal-feedback">
                  <span>ПЕРСОНАЛЬНАЯ ОБРАТНАЯ СВЯЗЬ</span><p>{analysis.personalFeedback}</p>
                </section>

                {analysis.scoreBreakdown.length > 0 && (
                  <section className="score-breakdown"><h3>ОЦЕНКА ПО КРИТЕРИЯМ</h3><div>{analysis.scoreBreakdown.map((item, index) => <article key={index}><header><strong>{item.criterion}</strong><span>{item.score} / {item.maxScore}</span></header><i><b style={{ width: `${Math.min(100, (item.score / item.maxScore) * 100)}%` }} /></i><p>{item.explanation}</p></article>)}</div></section>
                )}
                <div className="analysis-grid">
                  <AnalysisList title="СИЛЬНЫЕ ХОДЫ" items={analysis.strengths} tone="positive" />
                  <AnalysisList title="РИСКИ" items={analysis.risks} tone="negative" />
                </div>

                {analysis.techniqueReview.length > 0 && (
                  <section className="technique-review"><h3>ПРИЁМЫ: ЧТО СРАБОТАЛО И ГДЕ НЕДОРАБОТАЛ</h3>{analysis.techniqueReview.map((item, index) => <article key={index} className={item.status}><header><strong>{item.technique}</strong><span>{item.status === "successful" ? "Успешно" : item.status === "partial" ? "Частично" : "Недоработано"}</span></header><div className="quote-pair"><blockquote><small>ВАША РЕПЛИКА</small>«{item.turnQuote}»</blockquote><blockquote><small>МЕТОДОЛОГИЯ ТАРАСОВА</small>«{item.sourceQuote}»</blockquote></div><p>{item.explanation}</p><footer><span>{item.section}</span>{item.methodologyAtomId && <Link href={`/admin/methodology?atom=${item.methodologyAtomId}`}>Открыть методический атом →</Link>}</footer></article>)}</section>
                )}

                {analysis.developmentPlan.length > 0 && (
                  <section className="development-plan"><h3>ЧТО РАЗВИВАТЬ И ВНЕДРЯТЬ В СВОЙ АРСЕНАЛ</h3><div>{analysis.developmentPlan.map((item, index) => <article key={index}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.skill}</strong><p>{item.why}</p><small>Практика: {item.practice}</small></div></article>)}</div></section>
                )}

                <div className="analysis-section"><h3>АЛЬТЕРНАТИВНЫЕ ХОДЫ</h3><ol>{analysis.alternatives.map((item, index) => <li key={index}>{item}</li>)}</ol></div>
                <footer className="report-footer"><span>Версия методологии: {analysis.methodologyVersion}</span><Link href="/admin/methodology">Перейти к базе методологии →</Link></footer>
              </>
            )}
          </section>
        )}

        <footer className="session-actions">
          <button className="start-session" onClick={startSession} disabled={isLive || isBusy}>
            <span>▶</span>{isBusy ? "ПОДКЛЮЧАЕМСЯ…" : "НАЧАТЬ ПЕРЕГОВОРЫ"}
          </button>
          <button className="end-session" onClick={endSession} disabled={!isLive}>
            <span>■</span>ЗАВЕРШИТЬ ПЕРЕГОВОРЫ
          </button>
        </footer>
        <div className="diagnostics"><span>WebRTC · GPT‑Realtime‑2</span><span>{eventCount} событий</span><span>{latency ? `ответ ${latency} мс` : "задержка —"}</span></div>
      </section>

      <aside className="opponent-panel neon-panel">
        <h2>ВАШ ОППОНЕНТ</h2>
        <section className="opponent-profile">
          <div className={`opponent-visual ${opponentSpeaking ? "speaking" : ""}`}>
            <Image src={opponent.image} alt={opponent.name} fill sizes="360px" priority />
            <div className="visual-scan" />
          </div>
          <div className="opponent-identity">
            <span>VIRTUAL NEGOTIATOR</span>
            <h3>{opponent.name}</h3>
            <p>{opponent.title}</p>
            <ul><li>◎ Рациональный подход</li><li>◈ Анализ интересов</li><li>♧ Ценит конкретику</li></ul>
          </div>
          <div className="avatar-choices" aria-label="Выбор оппонента">
            {(Object.keys(OPPONENTS) as VoiceMode[]).map((mode) => (
              <button key={mode} className={voiceMode === mode ? "selected" : ""} onClick={() => setVoiceMode(mode)} disabled={isLive || isBusy} aria-label={mode === "female" ? "Женский голос" : "Мужской голос"}>
                <Image src={OPPONENTS[mode].image} alt="" width={62} height={62} />
              </button>
            ))}
          </div>
          <p className="opponent-style">{opponent.style}</p>
        </section>

        <h2 className="case-title">ОПИСАНИЕ КЕЙСА</h2>
        <section className="case-description">
          <CaseBlock icon="◇" title="КРАТКОЕ ОПИСАНИЕ">{selectedCase.summary}</CaseBlock>
          <CaseBlock icon="▤" title="КОНТЕКСТ">{selectedCase.situation}</CaseBlock>
          <CaseBlock icon="⚔" title="КОНФЛИКТ">{selectedCase.conflict}</CaseBlock>
          <RoleCaseBlock title="РОЛЬ 1" role={selectedCase.userRole} selected={selectedRoleSide === "user"} />
          <RoleCaseBlock title="РОЛЬ 2" role={selectedCase.opponentRole} selected={selectedRoleSide === "opponent"} />
        </section>
      </aside>

      {quickUploadOpen && (
        <div className="case-upload-modal" role="dialog" aria-modal="true" aria-labelledby="quick-case-title">
          <button className="case-modal-backdrop" aria-label="Закрыть" onClick={() => quickStatus !== "loading" && setQuickUploadOpen(false)} />
          <section>
            <header><div><span>БЫСТРОЕ ДОБАВЛЕНИЕ</span><h2 id="quick-case-title">Загрузить кейс</h2></div><button onClick={() => setQuickUploadOpen(false)} disabled={quickStatus === "loading"} aria-label="Закрыть">×</button></header>
            <p>Выберите один файл. Система сохранит оригинал, извлечёт факты, приведёт ситуацию и роли к каноническому виду и добавит готовый кейс в список.</p>
            <label className="quick-file-drop"><input type="file" accept=".txt,.md,.csv,.json,.xml,.html,.htm,.rtf,.pdf,.docx" onChange={(event) => setQuickFile(event.target.files?.[0] || null)} /><strong>{quickFile ? quickFile.name : "ВЫБРАТЬ ФАЙЛ"}</strong><small>TXT, MD, CSV, JSON, XML, HTML, RTF, PDF или DOCX · до 3 МБ</small></label>
            {quickError && <div className="error-banner"><strong>Не удалось загрузить кейс</strong><span>{quickError}</span></div>}
            <footer><button className="modal-secondary" onClick={() => setQuickUploadOpen(false)} disabled={quickStatus === "loading"}>ОТМЕНА</button><button className="modal-primary" onClick={uploadQuickCase} disabled={!quickFile || quickStatus === "loading"}>{quickStatus === "loading" ? "АНАЛИЗИРУЕМ И СОХРАНЯЕМ…" : "ЗАГРУЗИТЬ И СОЗДАТЬ КЕЙС"}</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}

function CaseSelect({ cases, value, onChange, disabled }: { cases: CanonicalCase[]; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label className="setting-group case-select-control">
      <span className="setting-label">КЕЙС</span>
      <span className="case-select-shell"><b>▣</b><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{cases.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><i>⌄</i></span>
    </label>
  );
}

function RoleSelect({ selectedCase, value, onChange, disabled }: { selectedCase: CanonicalCase; value: RoleSide; onChange: (value: RoleSide) => void; disabled: boolean }) {
  return (
    <label className="setting-group case-select-control">
      <span className="setting-label">ВАША РОЛЬ</span>
      <span className="case-select-shell"><b>♙</b><select value={value} onChange={(event) => onChange(event.target.value as RoleSide)} disabled={disabled} aria-label="Ваша роль"><option value="user">{selectedCase.userRole.name}</option><option value="opponent">{selectedCase.opponentRole.name}</option></select><i>⌄</i></span>
    </label>
  );
}

function DisabledSelect({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <label className="setting-group disabled-select">
      <span className="setting-label">{label}</span>
      <button disabled title="Будет доступно в следующей версии"><span>{icon}</span>{value}<b>⌄</b></button>
    </label>
  );
}

function CaseBlock({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return <div className="case-block"><h3><span>{icon}</span>{title}</h3><div>{children}</div></div>;
}

function RoleCaseBlock({ title, role, selected }: { title: string; role: CanonicalCase["userRole"]; selected: boolean }) {
  return (
    <div className={`case-block canonical-role ${selected ? "selected" : ""}`}>
      <h3><span>♙</span>{title}{selected && <b>ВЫ В ЭТОЙ РОЛИ</b>}</h3>
      <div><strong>{role.name}</strong><small>{role.position}</small><p><b>Цель:</b> {role.publicGoal}</p><h4>Интересы</h4><ul>{role.interests.map((item) => <li key={item}>{item}</li>)}</ul><h4>Ограничения</h4><ul>{role.constraints.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </div>
  );
}

function AnalysisList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "negative" }) {
  return <div className={`analysis-list ${tone}`}><h3>{title}</h3><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>;
}
