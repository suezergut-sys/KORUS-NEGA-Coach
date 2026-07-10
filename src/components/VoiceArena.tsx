"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "connected" | "error";
type Speaker = "Вы" | "Оппонент" | "Система";
type Line = { id: string; author: Speaker; text: string; time: string };
type VoiceMode = "female" | "male";

const CASE_CONTEXT =
  "Компания «Альтаир» внедряет новую CRM. Ключевой этап проекта сорван, а заказчик требует назвать ответственного и компенсировать задержку.";

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

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const responseStartedAtRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const opponent = OPPONENTS[voiceMode];
  const isLive = status === "connected";
  const isBusy = status === "connecting";

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

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
        context: CASE_CONTEXT,
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

  function endSession() {
    if (!isLive) return;
    setLines((current) => [...current, { id: crypto.randomUUID(), author: "Система", text: "Переговоры завершены пользователем.", time: clockTime() }]);
    closeSession();
  }

  return (
    <main className="duel-app">
      <aside className="nav-rail" aria-label="Разделы приложения">
        <div className="duel-symbol" aria-hidden="true">D</div>
        <button className="rail-button active" aria-label="Переговоры">⌂</button>
        <button className="rail-button" aria-label="Цели" disabled>◎</button>
        <button className="rail-button" aria-label="Статистика" disabled>▥</button>
        <button className="rail-button" aria-label="История" disabled>▤</button>
        <button className="rail-button" aria-label="Достижения" disabled>♜</button>
        <div className="rail-spacer" />
        <button className="rail-button" aria-label="Помощь" disabled>?</button>
        <button className="rail-avatar" aria-label="Профиль пользователя">Д</button>
      </aside>

      <aside className="settings-panel neon-panel">
        <header className="settings-header">
          <div className="brand-lockup"><strong>DUEL</strong><span>ТРЕНАЖЁР ПЕРЕГОВОРОВ</span></div>
          <span className="prototype-badge">ПРОТОТИП</span>
        </header>
        <h2><span>⚙</span> НАСТРОЙКИ</h2>

        <DisabledSelect label="КЕЙС" value="Сорванный срок проекта" icon="▣" />
        <DisabledSelect label="РОЛЬ" value="Руководитель проекта" icon="♙" />

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

        <section className="setting-group is-disabled extras">
          <div className="setting-label">ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ <i>i</i></div>
          <div><span>Показывать подсказки</span><span className="fake-toggle" /></div>
          <div><span>Авто-анализ после завершения</span><span className="fake-toggle on" /></div>
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
          <CaseBlock icon="▤" title="КОНТЕКСТ">{CASE_CONTEXT}</CaseBlock>
          <CaseBlock icon="◎" title="ЦЕЛЬ">Сохранить рабочие отношения, добиться признания ответственности и согласовать реалистичный план исправления ситуации.</CaseBlock>
          <CaseBlock icon="▣" title="ОГРАНИЧЕНИЯ">
            <ul><li>Нельзя перекладывать ответственность на заказчика</li><li>Срок восстановления — не более 10 рабочих дней</li><li>Ключевого сотрудника желательно сохранить</li></ul>
          </CaseBlock>
        </section>
      </aside>
    </main>
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
