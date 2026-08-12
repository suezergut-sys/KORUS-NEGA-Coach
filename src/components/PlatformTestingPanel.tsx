"use client";

import { useEffect, useRef, useState } from "react";
import { FIRST_OPPONENT_TURN_INSTRUCTIONS } from "@/lib/realtime-language";
import {
  closeRealtimeConnection,
  fetchWithTimeout,
  requestRealtimeResponse,
  waitForDataChannelOpen,
} from "@/lib/realtime-webrtc";
import {
  PLATFORM_TEST_DURATIONS,
  type PlatformTestCaseOption,
  type PlatformTestDuration,
  type PlatformTestReport,
  type PlatformTestTraceEvent,
  type PlatformTestTurn,
} from "@/lib/platform-test";

type TestStatus = "idle" | "connecting" | "running" | "finishing" | "completed" | "error";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function decodeBase64(base64: string) {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)).buffer;
}

function statusLabel(status: TestStatus, generating: boolean, opponentSpeaking: boolean, humanSpeaking: boolean) {
  if (status === "connecting") return "Подключаем Realtime";
  if (status === "finishing") return "Формируем отчёт";
  if (status === "completed") return "Тест завершён";
  if (status === "error") return "Тест остановлен";
  if (status !== "running") return "Готов к запуску";
  if (generating) return "AI-участник готовит реплику";
  if (humanSpeaking) return "AI-участник говорит";
  if (opponentSpeaking) return "Оппонент отвечает";
  return "Ожидаем следующий ход";
}

export default function PlatformTestingPanel({ cases }: { cases: PlatformTestCaseOption[] }) {
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || "");
  const [durationMinutes, setDurationMinutes] = useState<PlatformTestDuration>(1);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [turns, setTurns] = useState<PlatformTestTurn[]>([]);
  const [report, setReport] = useState<PlatformTestReport | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [humanSpeaking, setHumanSpeaking] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const opponentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const silenceSourceRef = useRef<OscillatorNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const transcriptionTimeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const runningRef = useRef(false);
  const turnsRef = useRef<PlatformTestTurn[]>([]);
  const eventsRef = useRef<PlatformTestTraceEvent[]>([]);
  const generatingRef = useRef(false);
  const pendingHumanTurnIdRef = useRef("");
  const pendingUserTranscriptAtRef = useRef(0);
  const currentOpponentTurnIdRef = useRef("");
  const finishTestRef = useRef<(reason: "manual" | "timer" | "anomaly") => Promise<void>>(async () => undefined);
  const generateHumanTurnRef = useRef<() => Promise<void>>(async () => undefined);

  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0];
  const isActive = status === "connecting" || status === "running" || status === "finishing";

  function recordEvent(type: string, details?: PlatformTestTraceEvent["details"]) {
    eventsRef.current = [...eventsRef.current, { atMs: performance.now(), type, details }].slice(-500);
  }

  function replaceTurns(next: PlatformTestTurn[]) {
    turnsRef.current = next;
    setTurns(next);
  }

  function appendTurn(turn: PlatformTestTurn) {
    replaceTurns([...turnsRef.current, turn]);
  }

  function updateTurn(id: string, update: Partial<PlatformTestTurn>) {
    replaceTurns(turnsRef.current.map((turn) => turn.id === id ? { ...turn, ...update } : turn));
  }

  function clearTimers() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (transcriptionTimeoutRef.current) window.clearTimeout(transcriptionTimeoutRef.current);
    timerRef.current = null;
    transcriptionTimeoutRef.current = null;
  }

  function releaseResources() {
    clearTimers();
    closeRealtimeConnection({
      channel: channelRef.current,
      peer: peerRef.current,
      stream: streamRef.current,
      audio: opponentAudioRef.current,
    });
    silenceSourceRef.current?.stop();
    silenceSourceRef.current?.disconnect();
    void audioContextRef.current?.close().catch(() => undefined);
    peerRef.current = null;
    channelRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    audioDestinationRef.current = null;
    silenceSourceRef.current = null;
    currentOpponentTurnIdRef.current = "";
    setHumanSpeaking(false);
    setOpponentSpeaking(false);
    setGenerating(false);
    generatingRef.current = false;
  }

  async function playHumanAudio(base64: string) {
    const context = audioContextRef.current;
    const destination = audioDestinationRef.current;
    if (!context || !destination) throw new Error("Виртуальный микрофон не готов.");
    if (context.state !== "running") await context.resume();
    const buffer = await context.decodeAudioData(decodeBase64(base64));
    const source = context.createBufferSource();
    const monitor = context.createGain();
    monitor.gain.value = 0.75;
    source.buffer = buffer;
    source.connect(destination);
    source.connect(monitor).connect(context.destination);
    setHumanSpeaking(true);
    source.start();
    await new Promise<void>((resolve) => { source.onended = () => resolve(); });
    source.disconnect();
    monitor.disconnect();
    setHumanSpeaking(false);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
  }

  async function generateHumanTurn() {
    if (!runningRef.current || generatingRef.current || !selectedCaseId) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const humanTurnIndex = turnsRef.current.filter((turn) => turn.speaker === "human").length + 1;
      const response = await fetchWithTimeout("/api/admin/platform-testing/human-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCaseId,
          participantRoleIndex: 0,
          opponentRoleIndex: 1,
          turnIndex: humanTurnIndex,
          turns: turnsRef.current,
        }),
      }, 60_000);
      const payload = await response.json() as { text?: string; audioBase64?: string; error?: string };
      if (!response.ok || !payload.text || !payload.audioBase64) {
        throw new Error(payload.error || "AI-участник не вернул аудиореплику.");
      }
      if (!runningRef.current) return;
      const turnId = `human-${crypto.randomUUID()}`;
      pendingHumanTurnIdRef.current = turnId;
      appendTurn({ id: turnId, speaker: "human", text: payload.text, atMs: performance.now() });
      recordEvent("human_turn_generated", { turnIndex: humanTurnIndex });
      await playHumanAudio(payload.audioBase64);
      if (!runningRef.current) return;
      transcriptionTimeoutRef.current = window.setTimeout(() => {
        if (!runningRef.current || !pendingHumanTurnIdRef.current) return;
        recordEvent("input_transcription_timeout", { turnId: pendingHumanTurnIdRef.current });
        void finishTestRef.current("anomaly");
      }, 20_000);
    } catch (caught) {
      recordEvent("participant_generation_failed", { message: caught instanceof Error ? caught.message : "Неизвестная ошибка" });
      setError(caught instanceof Error ? caught.message : "Не удалось создать реплику AI-участника.");
      if (runningRef.current) await finishTestRef.current("anomaly");
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }
  function handleRealtimeMessage(raw: MessageEvent<string>) {
    try {
      const event = JSON.parse(raw.data) as Record<string, unknown>;
      const type = String(event.type || "");
      const response = event.response && typeof event.response === "object" ? event.response as Record<string, unknown> : {};
      const statusValue = typeof response.status === "string" ? response.status : "";
      const details: PlatformTestTraceEvent["details"] = {};
      if (statusValue) details.status = statusValue;
      if (typeof event.transcript === "string") details.transcript = event.transcript.slice(0, 2_000);
      if (type === "error" && event.error && typeof event.error === "object") {
        const errorDetails = event.error as Record<string, unknown>;
        details.message = String(errorDetails.message || "Realtime error").slice(0, 1_000);
      }
      if (type !== "response.output_audio.delta") recordEvent(type, details);

      if (type === "response.created") {
        if (pendingUserTranscriptAtRef.current) {
          recordEvent("response_latency", { latencyMs: Math.max(0, performance.now() - pendingUserTranscriptAtRef.current) });
          pendingUserTranscriptAtRef.current = 0;
        }
      }
      if (type === "response.output_audio_transcript.delta") {
        const itemId = String(event.item_id || event.response_id || "active");
        const delta = String(event.delta || "");
        const turnId = currentOpponentTurnIdRef.current || `opponent-${itemId}-${crypto.randomUUID()}`;
        if (!currentOpponentTurnIdRef.current) {
          currentOpponentTurnIdRef.current = turnId;
          appendTurn({ id: turnId, speaker: "opponent", text: delta, atMs: performance.now() });
        } else {
          const existing = turnsRef.current.find((turn) => turn.id === turnId);
          updateTurn(turnId, { text: `${existing?.text || ""}${delta}` });
        }
      }
      if (type === "response.output_audio_transcript.done") {
        const transcript = String(event.transcript || "").trim();
        const turnId = currentOpponentTurnIdRef.current || `opponent-${crypto.randomUUID()}`;
        if (currentOpponentTurnIdRef.current) updateTurn(turnId, { text: transcript || turnsRef.current.find((turn) => turn.id === turnId)?.text || "" });
        else if (transcript) appendTurn({ id: turnId, speaker: "opponent", text: transcript, atMs: performance.now() });
      }
      if (type === "output_audio_buffer.started") setOpponentSpeaking(true);
      if (type === "output_audio_buffer.stopped") {
        setOpponentSpeaking(false);
        currentOpponentTurnIdRef.current = "";
        if (runningRef.current) window.setTimeout(() => void generateHumanTurnRef.current(), 850);
      }
      if (type === "input_audio_buffer.speech_started") setHumanSpeaking(true);
      if (type === "input_audio_buffer.speech_stopped") setHumanSpeaking(false);
      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = String(event.transcript || "").trim();
        const turnId = pendingHumanTurnIdRef.current;
        if (turnId) updateTurn(turnId, { recognizedText: transcript });
        pendingHumanTurnIdRef.current = "";
        if (transcriptionTimeoutRef.current) window.clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
        pendingUserTranscriptAtRef.current = performance.now();
        if (runningRef.current) requestRealtimeResponse(channelRef.current);
      }
    } catch {
      recordEvent("invalid_realtime_event");
    }
  }

  async function finishTest(reason: "manual" | "timer" | "anomaly") {
    if (!runningRef.current && status !== "connecting") return;
    runningRef.current = false;
    recordEvent("test_finished", { reason });
    const durationSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1_000) : 0;
    const snapshotTurns = turnsRef.current;
    const snapshotEvents = eventsRef.current;
    setStatus("finishing");
    releaseResources();
    try {
      const response = await fetchWithTimeout("/api/admin/platform-testing/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCaseId, durationSeconds, turns: snapshotTurns, events: snapshotEvents }),
      }, 90_000);
      const payload = await response.json() as { report?: PlatformTestReport; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || "Отчёт не сформирован.");
      setReport(payload.report);
      setStatus("completed");
      setRemainingSeconds(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сформировать отчёт.");
      setStatus("error");
    }
  }
  useEffect(() => {
    generateHumanTurnRef.current = generateHumanTurn;
    finishTestRef.current = finishTest;
  });

  async function startTest() {
    if (isActive || !selectedCase) return;
    releaseResources();
    setError("");
    setReport(null);
    replaceTurns([]);
    eventsRef.current = [];
    pendingHumanTurnIdRef.current = "";
    pendingUserTranscriptAtRef.current = 0;
    setRemainingSeconds(durationMinutes * 60);
    setStatus("connecting");
    recordEvent("test_started", { durationMinutes, caseId: selectedCase.id });

    try {
      const health = await fetchWithTimeout("/api/admin/platform-testing/realtime", { cache: "no-store" }, 10_000);
      if (!health.ok) throw new Error("OpenAI Realtime недоступен на сервере.");
      const context = new AudioContext({ sampleRate: 48_000 });
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      const silence = context.createOscillator();
      silence.connect(silentGain).connect(destination);
      silence.start();
      audioContextRef.current = context;
      audioDestinationRef.current = destination;
      silenceSourceRef.current = silence;
      streamRef.current = destination.stream;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addEventListener("connectionstatechange", () => {
        recordEvent("peer_state", { state: peer.connectionState });
        if (peer.connectionState === "failed" && runningRef.current) {
          recordEvent("connection_failed", { state: peer.connectionState });
          void finishTestRef.current("anomaly");
        }
      });
      peer.ontrack = (event) => {
        if (!opponentAudioRef.current) return;
        opponentAudioRef.current.srcObject = event.streams[0];
        void opponentAudioRef.current.play().catch(() => {
          recordEvent("opponent_audio_playback_failed");
          setError("Браузер заблокировал воспроизведение речи оппонента. Разрешите звук и запустите тест снова.");
        });
      };
      destination.stream.getTracks().forEach((track) => peer.addTrack(track, destination.stream));

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("message", handleRealtimeMessage);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const endpoint = new URL("/api/admin/platform-testing/realtime", window.location.origin);
      endpoint.searchParams.set("caseId", selectedCase.id);
      endpoint.searchParams.set("participantRoleIndex", "0");
      endpoint.searchParams.set("opponentRoleIndex", "1");
      endpoint.searchParams.set("negotiationStyle", "collaborative");
      endpoint.searchParams.set("voice", selectedCase.opponentVoiceGender === "male" ? "cedar" : "marin");
      const answer = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      }, 30_000);
      if (!answer.ok) {
        const payload = await answer.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Не удалось открыть Realtime-сессию.");
      }
      await peer.setRemoteDescription({ type: "answer", sdp: await answer.text() });
      await waitForDataChannelOpen(channel, 25_000);
      runningRef.current = true;
      startedAtRef.current = Date.now();
      setStatus("running");
      timerRef.current = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1_000);
        const remaining = Math.max(0, durationMinutes * 60 - elapsedSeconds);
        setRemainingSeconds(remaining);
        if (remaining === 0) void finishTestRef.current("timer");
      }, 1_000);
      requestRealtimeResponse(channel, FIRST_OPPONENT_TURN_INSTRUCTIONS);
    } catch (caught) {
      runningRef.current = false;
      recordEvent("connection_failed", { message: caught instanceof Error ? caught.message : "Неизвестная ошибка" });
      releaseResources();
      setError(caught instanceof Error ? caught.message : "Не удалось запустить тест.");
      setStatus("error");
    }
  }

  useEffect(() => () => {
    runningRef.current = false;
    clearTimers();
    closeRealtimeConnection({
      channel: channelRef.current,
      peer: peerRef.current,
      stream: streamRef.current,
      audio: opponentAudioRef.current,
    });
    silenceSourceRef.current?.stop();
    void audioContextRef.current?.close().catch(() => undefined);
  }, []);

  return (
    <div className="platform-test-workspace">
      <section className="platform-test-controls" aria-label="Настройки теста платформы">
        <label>
          <span>Кейс</span>
          <select value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)} disabled={isActive}>
            {cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <fieldset disabled={isActive}>
          <legend>Время теста</legend>
          <div>
            {PLATFORM_TEST_DURATIONS.map((minutes) => (
              <button key={minutes} type="button" className={durationMinutes === minutes ? "selected" : ""} onClick={() => setDurationMinutes(minutes)}>{minutes} мин</button>
            ))}
          </div>
        </fieldset>
        <div className="platform-test-role-pair">
          <span><small>AI-участник</small><strong>{selectedCase?.participantName || "—"}</strong><em>{selectedCase?.participantPosition || ""}</em></span>
          <b>↔</b>
          <span><small>AI-оппонент</small><strong>{selectedCase?.opponentName || "—"}</strong><em>{selectedCase?.opponentPosition || ""}</em></span>
        </div>
        <div className="platform-test-actions">
          <button type="button" className="platform-test-start" onClick={() => void startTest()} disabled={isActive || !cases.length}>▶ ЗАПУСТИТЬ ТЕСТ</button>
          <button type="button" className="platform-test-stop" onClick={() => void finishTest("manual")} disabled={status !== "running"}>■ ЗАВЕРШИТЬ И СОЗДАТЬ ОТЧЁТ</button>
        </div>
        <p>Реплики участника создаёт AI и произносит через виртуальный микрофон. Звук оппонента воспроизводится в браузере. Акустическая оценка эмоций пока не выполняется.</p>
      </section>

      <section className="platform-test-live" aria-label="Ход теста">
        <header>
          <div><i className={status === "running" ? "live" : ""} /><span>{statusLabel(status, generating, opponentSpeaking, humanSpeaking)}</span></div>
          <strong>{formatTime(remainingSeconds)}</strong>
        </header>
        <audio ref={opponentAudioRef} className="platform-test-audio" controls autoPlay aria-label="Речь AI-оппонента" />
        <div className="platform-test-transcript" aria-live="polite">
          {!turns.length ? (
            <div className="platform-test-empty"><strong>Стенограмма появится после запуска</strong><span>Первым начинает AI-оппонент.</span></div>
          ) : turns.map((turn) => (
            <article key={turn.id} className={turn.speaker}>
              <header><strong>{turn.speaker === "human" ? selectedCase?.participantName : selectedCase?.opponentName}</strong><span>{turn.speaker === "human" ? "AI-участник" : "AI-оппонент"}</span></header>
              <p>{turn.text}</p>
              {turn.speaker === "human" && turn.recognizedText && turn.recognizedText !== turn.text && <small>Распознано: {turn.recognizedText}</small>}
            </article>
          ))}
        </div>
        {error && <div className="platform-test-error" role="alert">{error}</div>}
      </section>

      {report && (
        <section className={`platform-test-report ${report.passed ? "passed" : "failed"}`} aria-label="Отчёт о тестировании">
          <header><div><span>ОТЧЁТ О ТЕСТИРОВАНИИ</span><h2>{report.passed ? "Аномалии не обнаружены" : `Обнаружено аномалий: ${report.anomalies.length}`}</h2><p>{report.summary}</p></div><strong>{report.passed ? "PASS" : "ATTENTION"}</strong></header>
          <div className="platform-test-metrics">
            <article><span>Реплики участника</span><strong>{report.metrics.humanTurns}</strong></article>
            <article><span>Реплики оппонента</span><strong>{report.metrics.opponentTurns}</strong></article>
            <article><span>Средний ответ</span><strong>{report.metrics.averageResponseLatencyMs === null ? "—" : `${(report.metrics.averageResponseLatencyMs / 1_000).toFixed(1)} с`}</strong></article>
            <article><span>Ошибки Realtime</span><strong>{report.metrics.realtimeErrors}</strong></article>
          </div>
          <div className="platform-test-anomalies">
            {report.anomalies.length === 0 ? <p>Технических и смысловых отклонений в этой сессии не найдено.</p> : report.anomalies.map((anomaly) => (
              <article key={anomaly.id} className={anomaly.severity}>
                <span>{anomaly.severity === "critical" ? "КРИТИЧНО" : anomaly.severity === "warning" ? "ВНИМАНИЕ" : "ИНФОРМАЦИЯ"}</span>
                <div><h3>{anomaly.title}</h3><p>{anomaly.details}</p>{anomaly.evidence && <blockquote>{anomaly.evidence}</blockquote>}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
