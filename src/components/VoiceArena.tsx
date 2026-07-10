"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "connected" | "error";
type Line = { id: string; author: "Вы" | "Алексей" | "Система"; text: string };

const defaultContext =
  "Ключевой сотрудник сорвал срок по важному клиенту. Вы хотите сохранить отношения, добиться ответственности и согласовать реалистичный план исправления ситуации.";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function VoiceArena() {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [difficulty, setDifficulty] = useState("Средняя");
  const [role, setRole] = useState("Алексей, руководитель отдела продаж");
  const [context, setContext] = useState(defaultContext);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [eventCount, setEventCount] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const responseStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "connected") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const closeSession = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => closeSession(), [closeSession]);

  const addLine = (author: Line["author"], text: string, id = crypto.randomUUID()) => {
    if (!text.trim()) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      if (existing === -1) return [...current, { id, author, text: text.trim() }].slice(-8);
      const next = [...current];
      next[existing] = { ...next[existing], text: text.trim() };
      return next;
    });
  };

  const handleEvent = (raw: MessageEvent<string>) => {
    try {
      const event = JSON.parse(raw.data) as Record<string, unknown>;
      const type = String(event.type || "");
      setEventCount((value) => value + 1);

      if (type === "input_audio_buffer.speech_stopped") {
        responseStartedAtRef.current = performance.now();
      }
      if (type === "response.output_audio.delta" && responseStartedAtRef.current) {
        setLatency(Math.round(performance.now() - responseStartedAtRef.current));
        responseStartedAtRef.current = null;
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        addLine("Вы", String(event.transcript || ""), String(event.item_id || crypto.randomUUID()));
      }
      if (type === "response.output_audio_transcript.done") {
        addLine("Алексей", String(event.transcript || ""), String(event.item_id || crypto.randomUUID()));
      }
      if (type === "error") {
        const nested = event.error as { message?: string } | undefined;
        setError(nested?.message || "Ошибка Realtime-сессии.");
      }
    } catch {
      // Ignore non-JSON diagnostics on the event channel.
    }
  };

  async function startSession() {
    if (status === "connecting" || status === "connected") return;
    setStatus("connecting");
    setError("");
    setSeconds(0);
    setEventCount(0);
    setLatency(null);
    setLines([{ id: "start", author: "Система", text: "Подключаем голосовой поединок…" }]);

    try {
      const health = await fetch("/api/realtime/session", { cache: "no-store" });
      if (!health.ok) {
        throw new Error("Для голосового теста добавьте OPENAI_API_KEY в настройки сервера.");
      }

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
        setLines([{ id: "ready", author: "Система", text: "Связь установлена. Алексей начинает первым." }]);
        channel.send(JSON.stringify({ type: "response.create" }));
      });
      channel.addEventListener("close", () => setStatus("idle"));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const params = new URLSearchParams({ role, difficulty, context: context.slice(0, 1200) });
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

  const isLive = status === "connected";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">П</span>
          <div>
            <strong>ПОЛИГОН</strong>
            <span>тренажёр переговоров</span>
          </div>
        </div>
        <nav aria-label="Основная навигация">
          <a className="active" href="#arena">Тренировка</a>
          <a href="#method">Методика</a>
          <a href="#history">История</a>
        </nav>
        <div className="profile">
          <div className="profile-copy"><strong>Дмитрий</strong><span>Уровень 3</span></div>
          <div className="avatar">Д</div>
        </div>
      </header>

      <main id="arena">
        <section className="hero">
          <div>
            <p className="eyebrow"><span /> НОВАЯ ТРЕНИРОВКА</p>
            <h1>Управленческий<br /><em>поединок</em></h1>
            <p className="lead">Проведите сложный разговор. ИИ-собеседник будет защищать свою позицию, реагировать на ваши аргументы и не даст уйти от сути.</p>
          </div>
          <div className="hero-number">01</div>
        </section>

        <section className="arena-grid">
          <article className="case-card">
            <div className="card-kicker"><span>КЕЙС</span><b>8–12 МИН</b></div>
            <h2>Сорванный срок<br />по ключевому клиенту</h2>
            <p>{context}</p>

            <div className="fact-grid">
              <div><span>ВАША РОЛЬ</span><strong>Руководитель отдела</strong></div>
              <div><span>СОБЕСЕДНИК</span><strong>Сильный, но упрямый сотрудник</strong></div>
              <div><span>ВАША ЦЕЛЬ</span><strong>Ответственность + план</strong></div>
              <div><span>РИСК</span><strong>Потерять сотрудника</strong></div>
            </div>
            <label className="context-field">
              <span>Контекст проекта для этого прогона</span>
              <textarea value={context} onChange={(event) => setContext(event.target.value)} maxLength={1200} disabled={isLive} />
            </label>
            <button className="swap-button" type="button" disabled={isLive} onClick={() => setContext(defaultContext)}>
              ↻ &nbsp;Сбросить контекст
            </button>
          </article>

          <aside className="opponent-card">
            <div className={`portrait ${isLive ? "is-speaking" : ""}`}>
              <div className="portrait-monogram">АК</div>
              <div className="live-tag"><i /> {isLive ? "В ЭФИРЕ" : "ГОТОВ"}</div>
            </div>
            <div className="opponent-copy">
              <span>ВАШ СОБЕСЕДНИК</span>
              <h3>Алексей Крылов</h3>
              <p>Руководитель отдела продаж</p>
            </div>
            <label className="select-label">
              Роль ИИ
              <select value={role} onChange={(event) => setRole(event.target.value)} disabled={isLive}>
                <option>Алексей, руководитель отдела продаж</option>
                <option>Ключевой сотрудник, который защищается</option>
                <option>Жёсткий заказчик, требующий компенсацию</option>
              </select>
            </label>
            <div className="trait-list"><span>РАЦИОНАЛЬНЫЙ</span><span>НАПОРИСТЫЙ</span><span>ПОМНИТ ДЕТАЛИ</span></div>
            <blockquote>«Я готов обсуждать результат. Но сначала давайте разберёмся, кто на самом деле сорвал сроки.»</blockquote>
          </aside>
        </section>

        <section className="control-panel">
          <div className="difficulty">
            <span>СЛОЖНОСТЬ</span>
            <div className="segmented">
              {["Мягкая", "Средняя", "Жёсткая"].map((item) => (
                <button key={item} className={difficulty === item ? "selected" : ""} onClick={() => setDifficulty(item)} disabled={isLive}>{item}</button>
              ))}
            </div>
          </div>

          <div className="voice-control">
            <button className={`talk-button ${isLive ? "stop" : ""}`} onClick={isLive ? closeSession : startSession} disabled={status === "connecting"}>
              <span className="mic-icon">{isLive ? "■" : "●"}</span>
              <span>{status === "connecting" ? "ПОДКЛЮЧАЕМ…" : isLive ? "ЗАВЕРШИТЬ ПОЕДИНОК" : "НАЧАТЬ ГОЛОСОМ"}</span>
              <small>{isLive ? formatTime(seconds) : "Разрешите доступ к микрофону"}</small>
            </button>
            <p><i /> WebRTC · GPT-Realtime-2 · семантический VAD</p>
          </div>

          <div className="tech-stats">
            <div><span>СОБЫТИЯ</span><strong>{eventCount}</strong></div>
            <div><span>ОТВЕТ ПОСЛЕ ПАУЗЫ</span><strong>{latency ? `${latency} мс` : "—"}</strong></div>
          </div>
        </section>

        {error && <div className="error-banner" role="alert"><strong>Не удалось начать тренировку.</strong> {error}</div>}

        {(lines.length > 0 || isLive) && (
          <section className="transcript" aria-live="polite">
            <div className="transcript-head"><span>ЖИВАЯ РАСШИФРОВКА</span><b>{isLive ? "ИДЁТ ЗАПИСЬ" : "СЕССИЯ ОСТАНОВЛЕНА"}</b></div>
            <div className="lines">
              {lines.map((line) => <p key={line.id} className={line.author === "Система" ? "system-line" : ""}><strong>{line.author}</strong>{line.text}</p>)}
            </div>
          </section>
        )}

        <footer>
          <div><span>ПОСЛЕ ПОЕДИНКА</span><p>Получите разбор решений, поворотных моментов и альтернативных ходов. Методическая оценка появится после загрузки и верификации книги.</p></div>
          <div className="footer-pill">В прототипе: проверка задержки</div>
        </footer>
      </main>
    </div>
  );
}
