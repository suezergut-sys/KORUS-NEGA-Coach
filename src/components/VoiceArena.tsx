"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppNavRail from "@/components/AppNavRail";
import type { NegotiationAnalysis } from "@/lib/analysis-types";
import type { CanonicalCase } from "@/lib/case-types";
import { getCaseComic, type ComicPanel } from "@/lib/case-comic";
import { DEFAULT_CASE } from "@/lib/default-case";
import type { NegotiationHint } from "@/lib/hint-types";
import { validateUploadSelection } from "@/lib/case-upload-constraints";

type Status = "idle" | "connecting" | "connected" | "error";
type Speaker = "Вы" | "Оппонент" | "Система";
type Line = { id: string; author: Speaker; text: string; time: string };
type VoiceMode = "female" | "male";
type NegotiationStyle = "collaborative" | "hard";
type DurationMinutes = 3 | 5 | 10 | 15;
type EndReason = "user" | "timer";
type AnalysisStatus = "idle" | "loading" | "ready" | "error";
type NarrationStatus = "idle" | "loading" | "playing" | "error";
type HintStatus = "idle" | "loading" | "ready" | "error";

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
const DURATION_OPTIONS: DurationMinutes[] = [3, 5, 10, 15];
const TIME_EXPIRED_MESSAGE = "Время переговоров истекло. Запускаем анализ поединка для определения победителя.";

function roleVoiceGender(role: CanonicalCase["userRole"]): VoiceMode {
  if (role.voiceGender === "female" || role.voiceGender === "male") return role.voiceGender;
  const firstName = role.name.trim().split(/\s+/)[0].toLowerCase();
  return /[ая]$/.test(firstName) ? "female" : "male";
}

function panelAudio(panel: ComicPanel, voiceMode: VoiceMode) {
  return typeof panel.audio === "string" ? panel.audio : panel.audio[voiceMode];
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clockTime() {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function updateTurnDetection(channel: RTCDataChannel | null, eagerness: "low" | "high") {
  if (channel?.readyState !== "open") return;
  channel.send(JSON.stringify({
    type: "session.update",
    session: {
      type: "realtime",
      audio: { input: { turn_detection: { type: "semantic_vad", eagerness, create_response: true, interrupt_response: true } } },
    },
  }));
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function waitForDataChannelOpen(channel: RTCDataChannel, timeoutMs = 25_000) {
  if (channel.readyState === "open") return Promise.resolve();
  if (channel.readyState !== "connecting") return Promise.reject(new Error("Голосовой канал закрылся до подключения."));
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      channel.removeEventListener("open", opened);
      channel.removeEventListener("close", closed);
      channel.removeEventListener("error", failed);
    };
    const opened = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error("Голосовой канал закрылся до подключения.")); };
    const failed = () => { cleanup(); reject(new Error("Не удалось открыть голосовой канал.")); };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Подключение заняло слишком много времени. Проверьте сеть и попробуйте снова."));
    }, timeoutMs);
    channel.addEventListener("open", opened);
    channel.addEventListener("close", closed);
    channel.addEventListener("error", failed);
  });
}

export default function VoiceArena() {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("male");
  const [negotiationStyle, setNegotiationStyle] = useState<NegotiationStyle>("collaborative");
  const [durationMinutes, setDurationMinutes] = useState<DurationMinutes>(5);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseUsed, setPauseUsed] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState<NegotiationAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [hintStatus, setHintStatus] = useState<HintStatus>("idle");
  const [hint, setHint] = useState<NegotiationHint | null>(null);
  const [hintError, setHintError] = useState("");
  const [hintUsed, setHintUsed] = useState(false);
  const [cases, setCases] = useState<CanonicalCase[]>([DEFAULT_CASE]);
  const [selectedCaseId, setSelectedCaseId] = useState(DEFAULT_CASE.id);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [opponentRoleIndex, setOpponentRoleIndex] = useState(1);
  const [remoteComic, setRemoteComic] = useState<ComicPanel[] | null>(null);
  const [comicMediaStatus, setComicMediaStatus] = useState("ready");
  const [casesError, setCasesError] = useState("");
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [quickStatus, setQuickStatus] = useState<"idle" | "loading" | "error">("idle");
  const [quickError, setQuickError] = useState("");
  const [caseContentOpen, setCaseContentOpen] = useState(false);
  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus>("idle");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("quickUpload") !== "1") return;
    const timer = window.setTimeout(() => setQuickUploadOpen(true), 0);
    url.searchParams.delete("quickUpload");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return () => window.clearTimeout(timer);
  }, []);
  const [narrationError, setNarrationError] = useState("");
  const [comicPanelIndex, setComicPanelIndex] = useState(0);
  const [comicDetailsOpen, setComicDetailsOpen] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const pausedRef = useRef(false);
  const endingRef = useRef(false);
  const hintUsedRef = useRef(false);
  const endSessionRef = useRef<(reason?: EndReason) => Promise<void>>(async () => undefined);
  const opponentTurnCountRef = useRef(0);
  const linesRef = useRef<Line[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const analysisRef = useRef<HTMLElement | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const voiceOverridesRef = useRef<Map<string, VoiceMode>>(new Map());
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationUrlRef = useRef<string | null>(null);
  const comicAudioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playNarrationRef = useRef<(panelIndex?: number) => Promise<void>>(async () => undefined);
  const startPendingRef = useRef(false);
  const quickUploadPendingRef = useRef(false);
  const hintPendingRef = useRef(false);
  const narrationPendingRef = useRef(false);
  const narrationAbortRef = useRef<AbortController | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);
  const elapsedActiveMsRef = useRef(0);
  const activeRunStartedAtRef = useRef<number | null>(null);
  const pauseEndsAtRef = useRef<number | null>(null);

  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0] || DEFAULT_CASE;
  const allRoles = [selectedCase.userRole, selectedCase.opponentRole, ...(selectedCase.additionalRoles || [])];
  const participantRole = allRoles[selectedRoleIndex] || allRoles[0];
  const aiRole = allRoles[opponentRoleIndex] || allRoles.find((_, index) => index !== selectedRoleIndex) || allRoles[0];
  const voiceProfile = OPPONENTS[voiceMode];
  const opponent = {
    ...voiceProfile,
    name: aiRole.name,
    title: aiRole.position,
  };
  const isLive = status === "connected";
  const isBusy = status === "connecting";
  const isPaused = pauseRemaining > 0;
  const isDuelMode = isBusy || isLive || isEnding;
  const isSettingsCollapsed = isDuelMode && settingsCollapsed;
  const totalDurationSeconds = durationMinutes * 60;
  const remainingSeconds = Math.max(0, totalDurationSeconds - seconds);
  const comicPanels = remoteComic || getCaseComic(selectedCase);
  const activeComicPanel = comicPanels[comicPanelIndex];

  const applyMediaPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !paused; });
    if (paused) {
      audioRef.current?.pause();
      setUserSpeaking(false);
      setOpponentSpeaking(false);
      return;
    }
    const audio = audioRef.current;
    if (audio) void audio.play().catch(() => undefined);
  }, []);

  const currentActiveSeconds = useCallback(() => {
    const runningMs = activeRunStartedAtRef.current === null ? 0 : Date.now() - activeRunStartedAtRef.current;
    return Math.max(0, Math.floor((elapsedActiveMsRef.current + runningMs) / 1000));
  }, []);

  const freezeActiveTimer = useCallback(() => {
    if (activeRunStartedAtRef.current !== null) {
      elapsedActiveMsRef.current += Date.now() - activeRunStartedAtRef.current;
      activeRunStartedAtRef.current = null;
    }
    const elapsed = currentActiveSeconds();
    setSeconds(elapsed);
    return elapsed;
  }, [currentActiveSeconds]);

  const resumeSession = useCallback(() => {
    pauseEndsAtRef.current = null;
    if (activeRunStartedAtRef.current === null) activeRunStartedAtRef.current = Date.now();
    applyMediaPaused(false);
    setPauseRemaining(0);
  }, [applyMediaPaused]);

  const announceTimeExpired = useCallback(() => new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(TIME_EXPIRED_MESSAGE);
    utterance.lang = "ru-RU";
    utterance.rate = 1;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 12_000);
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }), []);

  useEffect(() => {
    if (!caseContentOpen || !comicPanels.length) return;
    comicPanels.forEach((panel) => {
      const source = panelAudio(panel, voiceMode);
      if (comicAudioCacheRef.current.has(source)) return;
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = source;
      audio.load();
      comicAudioCacheRef.current.set(source, audio);
    });
  }, [caseContentOpen, comicPanels, voiceMode]);

  const stopNarration = useCallback(() => {
    narrationAbortRef.current?.abort();
    narrationAbortRef.current = null;
    narrationPendingRef.current = false;
    narrationAudioRef.current?.pause();
    narrationAudioRef.current = null;
    if (narrationUrlRef.current) URL.revokeObjectURL(narrationUrlRef.current);
    narrationUrlRef.current = null;
    setNarrationStatus("idle");
  }, []);

  const playNarration = useCallback(async (panelIndex?: number) => {
    if (narrationPendingRef.current) return;
    if (narrationStatus === "loading" || narrationStatus === "playing") {
      stopNarration();
      return;
    }
    narrationPendingRef.current = true;
    const controller = new AbortController();
    narrationAbortRef.current = controller;
    setNarrationStatus("loading");
    setNarrationError("");
    try {
      const preparedIndex = typeof panelIndex === "number" ? panelIndex : -1;
      const preparedPanel = preparedIndex >= 0 ? comicPanels[preparedIndex] : undefined;
      if (preparedPanel) {
        const source = panelAudio(preparedPanel, voiceMode);
        const audio = comicAudioCacheRef.current.get(source) || new Audio(source);
        audio.currentTime = 0;
        narrationAudioRef.current = audio;
        audio.onended = () => {
          stopNarration();
          if (preparedIndex < comicPanels.length - 1) {
            const next = preparedIndex + 1;
            setComicPanelIndex(next);
            window.setTimeout(() => void playNarrationRef.current(next), 50);
          }
        };
        audio.onerror = () => {
          stopNarration();
          setNarrationStatus("error");
          setNarrationError("Не удалось воспроизвести подготовленное аудио.");
        };
        await audio.play();
        setNarrationStatus("playing");
        return;
      }
      const response = await fetch("/api/cases/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCase.id, participantRoleIndex: selectedRoleIndex, opponentRoleIndex, voice: opponent.voice, panelIndex }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Не удалось озвучить кейс.");
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      narrationUrlRef.current = url;
      narrationAudioRef.current = audio;
      audio.onended = () => {
        stopNarration();
        if (typeof panelIndex === "number" && panelIndex < comicPanels.length - 1) {
          const next = panelIndex + 1;
          setComicPanelIndex(next);
          window.setTimeout(() => void playNarrationRef.current(next), 250);
        }
      };
      audio.onerror = () => {
        stopNarration();
        setNarrationStatus("error");
        setNarrationError("Не удалось воспроизвести аудио.");
      };
      await audio.play();
      setNarrationStatus("playing");
    } catch (caught) {
      if (controller.signal.aborted) return;
      stopNarration();
      setNarrationStatus("error");
      setNarrationError(caught instanceof Error ? caught.message : "Не удалось озвучить кейс.");
    } finally {
      if (narrationAbortRef.current === controller) narrationAbortRef.current = null;
      narrationPendingRef.current = false;
    }
  }, [comicPanels, narrationStatus, opponent.voice, opponentRoleIndex, selectedCase.id, selectedRoleIndex, stopNarration, voiceMode]);

  useEffect(() => {
    playNarrationRef.current = playNarration;
  }, [playNarration]);

  useEffect(() => {
    if (selectedCase.id.startsWith("default-")) return;
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const response = await fetch(`/api/cases/${selectedCase.id}/comic`, { cache: "no-store" });
        const payload = await response.json() as { status?: string; error?: string; versions?: Record<string, ComicPanel[]> };
        if (!response.ok) throw new Error(payload.error || "Не удалось проверить готовность комикса.");
        if (cancelled) return;
        setComicMediaStatus(payload.status || "pending");
        setRemoteComic(payload.versions?.[String(selectedRoleIndex)] || null);
        if (payload.status === "pending" || payload.status === "processing") timer = window.setTimeout(load, 5000);
      } catch (caught) {
        if (cancelled) return;
        setComicMediaStatus("failed");
        setNarrationError(caught instanceof Error ? caught.message : "Не удалось проверить готовность комикса.");
      }
    };
    void load();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [selectedCase.id, selectedRoleIndex]);

  const toggleNarration = useCallback(() => {
    if (narrationStatus === "loading" || narrationStatus === "playing") return stopNarration();
    return playNarration(comicPanels.length ? comicPanelIndex : undefined);
  }, [comicPanelIndex, comicPanels.length, narrationStatus, playNarration, stopNarration]);

  const loadCases = useCallback(async (preferredId?: string) => {
    try {
      const response = await fetch("/api/cases", { cache: "no-store" });
      const payload = (await response.json()) as { cases?: CanonicalCase[]; error?: string };
      if (!response.ok || !payload.cases?.length) throw new Error(payload.error || "База кейсов пока недоступна.");
      setCases(payload.cases);
      const queryId = preferredId || new URLSearchParams(window.location.search).get("case") || "";
      const nextCase = payload.cases.find((item) => item.id === queryId) || payload.cases[0];
      setSelectedCaseId(nextCase.id);
      const nextRoles = [nextCase.userRole, nextCase.opponentRole, ...(nextCase.additionalRoles || [])];
      const randomOpponent = 1 + Math.floor(Math.random() * Math.max(1, nextRoles.length - 1));
      setOpponentRoleIndex(Math.min(randomOpponent, nextRoles.length - 1));
      const nextAiRole = nextRoles[Math.min(randomOpponent, nextRoles.length - 1)];
      setVoiceMode(voiceOverridesRef.current.get(nextAiRole.name) || roleVoiceGender(nextAiRole));
      if (preferredId) setSelectedRoleIndex(0);
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
    if (!isLive || isPaused || isEnding) return;
    const tick = () => setSeconds(Math.min(totalDurationSeconds, currentActiveSeconds()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [currentActiveSeconds, isEnding, isLive, isPaused, totalDurationSeconds]);

  useEffect(() => {
    if (!isLive || isPaused || isEnding || remainingSeconds > 0) return;
    const timer = window.setTimeout(() => void endSessionRef.current("timer"), 0);
    return () => window.clearTimeout(timer);
  }, [isEnding, isLive, isPaused, remainingSeconds]);

  useEffect(() => {
    if (!isLive || pauseRemaining <= 0) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((pauseEndsAtRef.current || Date.now()) - Date.now()) / 1000));
      if (remaining <= 0) resumeSession();
      else setPauseRemaining(remaining);
    }, 250);
    return () => window.clearInterval(timer);
  }, [isLive, pauseRemaining, resumeSession]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    if (analysisStatus === "ready") analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [analysisStatus]);

  function chooseCase(caseId: string) {
    if (isLive || isBusy) return;
    stopNarration();
    setSelectedCaseId(caseId);
    setComicPanelIndex(0);
    setComicDetailsOpen(false);
    setSelectedRoleIndex(0);
    const nextCase = cases.find((item) => item.id === caseId);
    const nextRoles = nextCase ? [nextCase.userRole, nextCase.opponentRole, ...(nextCase.additionalRoles || [])] : [];
    const randomOpponent = nextRoles.length > 1 ? 1 + Math.floor(Math.random() * (nextRoles.length - 1)) : 0;
    setOpponentRoleIndex(randomOpponent);
    setRemoteComic(null);
    if (nextCase) {
      const nextAiRole = nextRoles[randomOpponent];
      setVoiceMode(voiceOverridesRef.current.get(nextAiRole.name) || roleVoiceGender(nextAiRole));
    }
    setLines([]);
    setAnalysis(null);
    setAnalysisStatus("idle");
    const url = new URL(window.location.href);
    url.searchParams.set("case", caseId);
    window.history.replaceState(null, "", url);
  }

  function chooseRole(index: number) {
    if (isLive || isBusy) return;
    stopNarration();
    setSelectedRoleIndex(index);
    const candidates = allRoles.map((_, roleIndex) => roleIndex).filter((roleIndex) => roleIndex !== index);
    const nextOpponentIndex = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    setOpponentRoleIndex(nextOpponentIndex);
    const nextAiRole = allRoles[nextOpponentIndex];
    setVoiceMode(voiceOverridesRef.current.get(nextAiRole.name) || roleVoiceGender(nextAiRole));
    setLines([]);
    setAnalysis(null);
    setAnalysisStatus("idle");
  }

  function chooseVoice(mode: VoiceMode) {
    if (isLive || isBusy) return;
    stopNarration();
    voiceOverridesRef.current.set(aiRole.name, mode);
    setVoiceMode(mode);
  }

  async function uploadQuickCase() {
    if (!quickFile || quickUploadPendingRef.current) return;
    quickUploadPendingRef.current = true;
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
      if (quickFileInputRef.current) quickFileInputRef.current.value = "";
      setQuickUploadOpen(false);
      setLines([{ id: crypto.randomUUID(), author: "Система", text: `Кейс «${payload.case.title}» добавлен в базу и выбран.`, time: clockTime() }]);
    } catch (caught) {
      setQuickStatus("error");
      setQuickError(caught instanceof Error ? caught.message : "Не удалось загрузить кейс.");
    } finally {
      quickUploadPendingRef.current = false;
    }
  }

  function chooseQuickFile(file: File | null) {
    try {
      if (file) validateUploadSelection([file]);
      setQuickFile(file);
      setQuickError("");
      setQuickStatus("idle");
    } catch (caught) {
      setQuickFile(null);
      if (quickFileInputRef.current) quickFileInputRef.current.value = "";
      setQuickStatus("error");
      setQuickError(caught instanceof Error ? caught.message : "Файл не подходит для загрузки.");
    }
  }

  const closeSession = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    window.speechSynthesis?.cancel();
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    pausedRef.current = false;
    setPauseRemaining(0);
    setPauseUsed(false);
    setIsEnding(false);
    setSettingsCollapsed(false);
    setUserSpeaking(false);
    setOpponentSpeaking(false);
    setStatus("idle");
  }, []);

  useEffect(() => () => closeSession(), [closeSession]);
  useEffect(() => () => stopNarration(), [stopNarration]);

  const replaceLine = useCallback((author: Speaker, text: string, id: string) => {
    if (!text.trim()) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      const line = { id, author, text: text.trim(), time: clockTime() };
      if (existing === -1) {
        const next = [...current, line];
        linesRef.current = next;
        return next;
      }
      const next = [...current];
      next[existing] = { ...next[existing], text: text.trim() };
      linesRef.current = next;
      return next;
    });
  }, []);

  const appendDelta = useCallback((author: Speaker, delta: string, id: string) => {
    if (!delta) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      if (existing === -1) {
        const next = [...current, { id, author, text: delta, time: clockTime() }];
        linesRef.current = next;
        return next;
      }
      const next = [...current];
      next[existing] = { ...next[existing], text: `${next[existing].text}${delta}` };
      linesRef.current = next;
      return next;
    });
  }, []);

  const handleEvent = useCallback((raw: MessageEvent<string>) => {
    try {
      const event = JSON.parse(raw.data) as Record<string, unknown>;
      const type = String(event.type || "");
      const itemId = String(event.item_id || event.response_id || crypto.randomUUID());
      if (pausedRef.current) return;

      if (type === "input_audio_buffer.speech_started") setUserSpeaking(true);
      if (type === "input_audio_buffer.speech_stopped") {
        setUserSpeaking(false);
      }
      if (type === "response.output_audio.delta" || type === "response.output_audio_transcript.delta") {
        setOpponentSpeaking(true);
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
        if (negotiationStyle === "hard") {
          opponentTurnCountRef.current += 1;
          updateTurnDetection(channelRef.current, opponentTurnCountRef.current % 5 === 0 ? "high" : "low");
        }
      }
      if (type === "error") {
        const nested = event.error as { message?: string } | undefined;
        setError(nested?.message || "Ошибка голосовой Realtime-сессии.");
      }
    } catch {
      // Диагностические сообщения вне JSON не влияют на голосовую сессию.
    }
  }, [appendDelta, negotiationStyle, replaceLine]);

  function togglePause() {
    if (!isLive) return;
    if (isPaused) {
      resumeSession();
      return;
    }
    if (pauseUsed) return;

    const channel = channelRef.current;
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      if (opponentSpeaking) channel.send(JSON.stringify({ type: "response.cancel" }));
    }
    freezeActiveTimer();
    setPauseUsed(true);
    pauseEndsAtRef.current = Date.now() + 60_000;
    setPauseRemaining(60);
    applyMediaPaused(true);
  }

  async function requestHint() {
    if (!isPaused || hintPendingRef.current || hintUsedRef.current) return;
    hintPendingRef.current = true;
    setHintStatus("loading");
    setHintError("");
    try {
      const response = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id === DEFAULT_CASE.id ? undefined : selectedCase.id,
          caseCode: selectedCase.slug,
          participantRoleIndex: selectedRoleIndex,
          opponentRoleIndex,
          turns: linesRef.current,
        }),
      });
      const payload = (await response.json()) as { hint?: NegotiationHint; error?: string };
      if (!response.ok || !payload.hint) throw new Error(payload.error || "Не удалось получить подсказку.");
      hintUsedRef.current = true;
      setHintUsed(true);
      setHint(payload.hint);
      setHintStatus("ready");
    } catch (caught) {
      setHintStatus("error");
      setHintError(caught instanceof Error ? caught.message : "Не удалось получить подсказку.");
    } finally {
      hintPendingRef.current = false;
    }
  }

  async function startSession() {
    if (startPendingRef.current || isBusy || isLive || analysisStatus === "loading") return;
    startPendingRef.current = true;
    stopNarration();
    setCaseContentOpen(false);
    setSettingsCollapsed(true);
    setStatus("connecting");
    setError("");
    setSeconds(0);
    setPauseRemaining(0);
    setPauseUsed(false);
    setIsEnding(false);
    pausedRef.current = false;
    elapsedActiveMsRef.current = 0;
    activeRunStartedAtRef.current = null;
    pauseEndsAtRef.current = null;
    endingRef.current = false;
    opponentTurnCountRef.current = 0;
    setAnalysisStatus("idle");
    setAnalysis(null);
    setAnalysisError("");
    setHintStatus("idle");
    setHint(null);
    setHintError("");
    setHintUsed(false);
    hintUsedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    const connectingLines: Line[] = [{ id: "connecting", author: "Система", text: "Устанавливаем защищённую голосовую связь…", time: clockTime() }];
    linesRef.current = connectingLines;
    setLines(connectingLines);

    try {
      const health = await fetchWithTimeout("/api/realtime/session", { cache: "no-store" }, 10_000);
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
        elapsedActiveMsRef.current = 0;
        activeRunStartedAtRef.current = Date.now();
        setStatus("connected");
        const readyLines: Line[] = [{ id: "ready", author: "Система", text: `Связь установлена. ${opponent.name} начинает переговоры.`, time: clockTime() }];
        linesRef.current = readyLines;
        setLines(readyLines);
        channel.send(JSON.stringify({ type: "response.create" }));
      });
      channel.addEventListener("close", () => {
        if (channelRef.current === channel && !endingRef.current) setStatus("idle");
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const params = new URLSearchParams({
        negotiationStyle,
        caseId: selectedCase.id,
        caseCode: selectedCase.slug,
        participantRoleIndex: String(selectedRoleIndex),
        opponentRoleIndex: String(opponentRoleIndex),
        voice: opponent.voice,
      });
      const response = await fetchWithTimeout(`/api/realtime/session?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Не удалось открыть голосовую сессию.");
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
      await waitForDataChannelOpen(channel);
    } catch (caught) {
      closeSession();
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось запустить микрофон.");
      linesRef.current = [];
      setLines([]);
    } finally {
      startPendingRef.current = false;
    }
  }

  async function endSession(reason: EndReason = "user") {
    if (!isLive || endingRef.current) return;
    endingRef.current = true;
    setIsEnding(true);
    const completedDurationSeconds = Math.min(totalDurationSeconds, freezeActiveTimer());
    const completedLines = [
      ...linesRef.current,
      { id: crypto.randomUUID(), author: "Система" as const, text: reason === "timer" ? TIME_EXPIRED_MESSAGE : "Переговоры завершены пользователем.", time: clockTime() },
    ];
    linesRef.current = completedLines;
    setLines(completedLines);
    if (reason === "timer") {
      applyMediaPaused(true);
      await announceTimeExpired();
    }
    closeSession();
    setIsEnding(true);
    setAnalysisStatus("loading");
    setAnalysisError("");

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id === DEFAULT_CASE.id ? undefined : selectedCase.id,
          caseCode: selectedCase.slug,
          participantRoleIndex: selectedRoleIndex,
          opponentRoleIndex,
          opponentVoice: opponent.voice,
          startedAt: startedAtRef.current,
          durationSeconds: completedDurationSeconds,
          usedHint: hintUsedRef.current,
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
    } finally {
      setIsEnding(false);
    }
  }

  useEffect(() => {
    endSessionRef.current = endSession;
  });

  return (
    <main className={`duel-app ${isDuelMode ? "duel-mode" : ""} ${isSettingsCollapsed ? "settings-collapsed" : ""}`}>
      <AppNavRail onQuickUpload={() => setQuickUploadOpen(true)} quickUploadDisabled={isLive || isBusy} />

      <aside className={`settings-panel neon-panel ${isSettingsCollapsed ? "is-collapsed" : ""}`}>
        {isSettingsCollapsed ? (
          <button className="rail-button settings-expand-button" onClick={() => setSettingsCollapsed(false)} aria-label="Развернуть настройки" title="Развернуть настройки">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        ) : (<>
        <header className="settings-header">
          <div className="brand-lockup"><strong>KORUS NEGA AI 2.0</strong><span>ТРЕНАЖЁР ПЕРЕГОВОРОВ</span></div>
          {isDuelMode && <button className="settings-collapse-button" onClick={() => setSettingsCollapsed(true)} aria-label="Свернуть настройки" title="Свернуть настройки"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button>}
        </header>
        <h2><span>⚙</span> НАСТРОЙКИ</h2>

        <CaseSelect cases={cases} value={selectedCase.id} onChange={chooseCase} disabled={isLive || isBusy} />
        <RoleSelect selectedCase={selectedCase} value={selectedRoleIndex} onChange={chooseRole} disabled={isLive || isBusy} />
        {casesError && <p className="case-select-error">{casesError}</p>}

        <section className="setting-group">
          <div className="setting-label">ГОЛОС ОППОНЕНТА <i>i</i></div>
          <div className="voice-switch" role="group" aria-label="Голос оппонента">
            <button
              className={voiceMode === "female" ? "selected" : ""}
              onClick={() => chooseVoice("female")}
              disabled={isLive || isBusy}
              aria-pressed={voiceMode === "female"}
            >
              <strong>♀</strong><span>Женский голос</span><small>Marin</small>
            </button>
            <button
              className={voiceMode === "male" ? "selected" : ""}
              onClick={() => chooseVoice("male")}
              disabled={isLive || isBusy}
              aria-pressed={voiceMode === "male"}
            >
              <strong>♂</strong><span>Мужской голос</span><small>Cedar</small>
            </button>
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-label">СТИЛЬ ПЕРЕГОВОРОВ <i>i</i></div>
          <div className="style-options" role="group" aria-label="Стиль переговоров">
            <button className={negotiationStyle === "collaborative" ? "selected" : ""} onClick={() => setNegotiationStyle("collaborative")} disabled={isLive || isBusy} aria-pressed={negotiationStyle === "collaborative"}>Сотрудничество</button>
            <button className={negotiationStyle === "hard" ? "selected" : ""} onClick={() => setNegotiationStyle("hard")} disabled={isLive || isBusy} aria-pressed={negotiationStyle === "hard"}>Жёсткие переговоры</button>
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-label">ТАЙМЕР <i>i</i></div>
          <div className="timer-options" role="group" aria-label="Длительность переговоров">
            {DURATION_OPTIONS.map((minutes) => <button key={minutes} className={durationMinutes === minutes ? "selected" : ""} onClick={() => setDurationMinutes(minutes)} disabled={isLive || isBusy} aria-pressed={durationMinutes === minutes}>{minutes} мин</button>)}
          </div>
        </section>
        </>)}
      </aside>

      <section className="conversation-panel neon-panel" aria-label="Переговоры">
        <header className="conversation-header">
          <div>
            <h1><span className="equalizer-icon">▥</span> ПЕРЕГОВОРЫ</h1>
            <p>Общайтесь с виртуальным оппонентом. Реплики появляются здесь в реальном времени.</p>
          </div>
          <div className="live-status">
            <span className={isLive && !isPaused ? "status-dot live" : "status-dot"} />
            <span>{isBusy ? "ПОДКЛЮЧЕНИЕ" : isEnding ? "ЗАВЕРШЕНИЕ" : isPaused ? "ПАУЗА" : isLive ? "В ЭФИРЕ" : "ГОТОВ"}</span>
            <strong>{formatTime(remainingSeconds)}</strong>
          </div>
        </header>

        <div className="dialogue-surface">
          {lines.length === 0 ? (
            <div className="empty-dialogue">
              <h3>Переговоры ещё не начались</h3>
              <button className="case-content-trigger" onClick={() => { setComicPanelIndex(0); setComicDetailsOpen(false); setCaseContentOpen(true); }}>Содержание кейса</button>
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

          <div className={`audio-deck ${isLive && !isPaused && !isEnding ? "active" : ""}`}>
            <div className="listening-copy"><span className={userSpeaking ? "mini-wave active" : "mini-wave"}>▥</span><small>{isEnding ? "Запускаем анализ…" : isPaused ? `Пауза ${formatTime(pauseRemaining)}` : userSpeaking ? "Вы говорите…" : opponentSpeaking ? "Оппонент отвечает…" : isLive ? "Слушаю…" : "Ожидание"}</small></div>
            <div className="waveform" aria-hidden="true">
              {WAVE_BARS.map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * -55}ms` }} />)}
            </div>
            <div className={`mic-orb ${userSpeaking ? "speaking" : ""}`}>◉</div>
          </div>
          <p className="speech-note">{isPaused ? "ⓘ Микрофон и оппонент на паузе. Нажмите кнопку с таймером, чтобы продолжить." : "ⓘ Говорите естественно. Система распознает речь и отобразит её в диалоге."}</p>
        </div>

        {error && <div className="error-banner" role="alert"><strong>Не удалось начать переговоры.</strong><span>{error}</span></div>}

        <footer className="session-actions">
          <button className="start-session" onClick={startSession} disabled={isLive || isBusy || isEnding || analysisStatus === "loading"}>
            <span>▶</span>{isBusy ? "ПОДКЛЮЧАЕМСЯ…" : isEnding ? "АНАЛИЗ…" : isLive ? `ОСТАЛОСЬ ${formatTime(remainingSeconds)}` : "НАЧАТЬ"}
          </button>
          <button className={`pause-session ${isPaused ? "counting" : ""}`} onClick={togglePause} disabled={!isLive || isEnding || (pauseUsed && !isPaused)} aria-label={isPaused ? `Продолжить переговоры, осталось ${formatTime(pauseRemaining)}` : "Пауза"}>
            <svg className="pause-icon" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4" height="14" rx="1" /><rect x="11" y="2" width="4" height="14" rx="1" /></svg>{isPaused ? `ПАУЗА · ${formatTime(pauseRemaining)}` : "ПАУЗА"}
          </button>
          <button className="end-session" onClick={() => void endSession("user")} disabled={!isLive || isEnding}>
            <span>■</span>ЗАВЕРШИТЬ
          </button>
        </footer>

        {isPaused && (
          <section className="hint-panel" aria-live="polite">
            <button className="hint-button" onClick={() => void requestHint()} disabled={hintStatus === "loading" || hintUsed}>
              {hintStatus === "loading" ? "ГОТОВИМ ПОДСКАЗКУ…" : hintUsed ? "ПОДСКАЗКА ИСПОЛЬЗОВАНА" : "ПОДСКАЗКА"}
            </button>
            <p className="hint-warning">Вы можете воспользоваться подсказкой, но в этом случае результат поединка не будет учтён в рейтинге и личном кабинете.</p>
            {hintStatus === "error" && <p className="hint-error">{hintError}</p>}
            {hintStatus === "ready" && hint && (
              <div className="hint-result">
                <span>ОБЩЕЕ НАПРАВЛЕНИЕ</span>
                <p>{hint.direction}</p>
                <div className="hint-columns">
                  <section><h3>ЧТО ДЕЛАТЬ ДАЛЬШЕ</h3><ol>{hint.nextActions.map((item, index) => <li key={index}>{item}</li>)}</ol></section>
                  <section><h3>ВАРИАНТЫ ФОРМУЛИРОВОК</h3><ul>{hint.suggestedPhrases.map((item, index) => <li key={index}>«{item}»</li>)}</ul></section>
                </div>
                <aside><strong>ИЗБЕГАЙТЕ</strong><p>{hint.watchOut}</p></aside>
              </div>
            )}
          </section>
        )}

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
              <button key={mode} className={voiceMode === mode ? "selected" : ""} onClick={() => chooseVoice(mode)} disabled={isLive || isBusy} aria-label={mode === "female" ? "Женский голос" : "Мужской голос"}>
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
          {allRoles.map((role, index) => <RoleCaseBlock key={role.name} title={`РОЛЬ ${index + 1}`} role={role} selected={selectedRoleIndex === index} />)}
        </section>
      </aside>

      {quickUploadOpen && (
        <div className="case-upload-modal" role="dialog" aria-modal="true" aria-labelledby="quick-case-title">
          <button className="case-modal-backdrop" aria-label="Закрыть" onClick={() => quickStatus !== "loading" && setQuickUploadOpen(false)} />
          <section>
            <header><div><span>БЫСТРОЕ ДОБАВЛЕНИЕ</span><h2 id="quick-case-title">Загрузить кейс</h2></div><button onClick={() => setQuickUploadOpen(false)} disabled={quickStatus === "loading"} aria-label="Закрыть">×</button></header>
            <p>Выберите один файл. Система сохранит оригинал, извлечёт факты, приведёт ситуацию и роли к каноническому виду и добавит готовый кейс в список.</p>
            <label className="quick-file-drop"><input ref={quickFileInputRef} type="file" accept=".txt,.md,.csv,.json,.xml,.html,.htm,.rtf,.pdf,.docx" disabled={quickStatus === "loading"} onChange={(event) => chooseQuickFile(event.target.files?.[0] || null)} /><strong>{quickFile ? quickFile.name : "ВЫБРАТЬ ФАЙЛ"}</strong><small>TXT, MD, CSV, JSON, XML, HTML, RTF, PDF или DOCX · до 3 МБ</small></label>
            {quickError && <div className="error-banner"><strong>Не удалось загрузить кейс</strong><span>{quickError}</span></div>}
            <footer><button className="modal-secondary" onClick={() => setQuickUploadOpen(false)} disabled={quickStatus === "loading"}>ОТМЕНА</button><button className="modal-primary" onClick={uploadQuickCase} disabled={!quickFile || quickStatus === "loading"}>{quickStatus === "loading" ? "АНАЛИЗИРУЕМ И СОХРАНЯЕМ…" : "ЗАГРУЗИТЬ И СОЗДАТЬ КЕЙС"}</button></footer>
          </section>
        </div>
      )}
      {caseContentOpen && !isLive && (
        <div className="case-content-modal" role="dialog" aria-modal="true" aria-labelledby="case-content-title">
          <button className="case-modal-backdrop" aria-label="Закрыть" onClick={() => { stopNarration(); setCaseContentOpen(false); }} />
          <section>
            <header>
              <div><span>ПЕРЕД НАЧАЛОМ ПОЕДИНКА</span><h2 id="case-content-title">{selectedCase.title}</h2></div>
              <button onClick={() => { stopNarration(); setCaseContentOpen(false); }} aria-label="Закрыть">×</button>
            </header>
            {!activeComicPanel && !comicDetailsOpen && (comicMediaStatus === "pending" || comicMediaStatus === "processing") ? (
              <div className="comic-preparing"><span className="analysis-spinner" /><h3>Готовим персональный комикс</h3><p>Раскадровка, изображения и аудиоверсия для роли «{participantRole.name}» создаются в фоне. Полное текстовое содержание уже доступно.</p><button className="comic-details-link" onClick={() => setComicDetailsOpen(true)}>Открыть текстовое содержание</button></div>
            ) : activeComicPanel && !comicDetailsOpen ? (
              <div className="comic-prologue">
                <div className="comic-stage">
                  <Image src={activeComicPanel.image} alt={activeComicPanel.title} fill sizes="(max-width: 900px) 100vw, 900px" priority unoptimized={activeComicPanel.image.startsWith("http")} />
                  <div className="comic-caption"><span>{activeComicPanel.eyebrow}</span><h3>{activeComicPanel.title}</h3><p>{activeComicPanel.narration}</p></div>
                  <button className="comic-arrow previous" disabled={comicPanelIndex === 0} onClick={() => { stopNarration(); setComicPanelIndex((value) => Math.max(0, value - 1)); }} aria-label="Предыдущий кадр">‹</button>
                  <button className="comic-arrow next" disabled={comicPanelIndex === comicPanels.length - 1} onClick={() => { stopNarration(); setComicPanelIndex((value) => Math.min(comicPanels.length - 1, value + 1)); }} aria-label="Следующий кадр">›</button>
                </div>
                <div className="comic-progress">{comicPanels.map((panel, index) => <button key={panel.image} className={index === comicPanelIndex ? "active" : ""} onClick={() => { stopNarration(); setComicPanelIndex(index); }} aria-label={`Кадр ${index + 1}`} />)}</div>
                <button className="comic-details-link" onClick={() => { stopNarration(); setComicDetailsOpen(true); }}>Открыть полное содержание кейса</button>
              </div>
            ) : <div className="case-content-copy">
              <p className="case-content-summary">{selectedCase.summary}</p>
              <CaseBlock icon="▤" title="СИТУАЦИЯ">{selectedCase.situation}</CaseBlock>
              <CaseBlock icon="⚔" title="ЦЕНТРАЛЬНЫЙ КОНФЛИКТ">{selectedCase.conflict}</CaseBlock>
              <div className="case-content-roles">
                {allRoles.map((role, index) => <RoleCaseBlock key={role.name} title={`РОЛЬ ${index + 1}`} role={role} selected={selectedRoleIndex === index} />)}
              </div>
              {selectedCase.stakes.length > 0 && <CaseBlock icon="◆" title="СТАВКИ"><ul>{selectedCase.stakes.map((item) => <li key={item}>{item}</li>)}</ul></CaseBlock>}
              <CaseBlock icon="▶" title="НАЧАЛЬНАЯ СИТУАЦИЯ">{selectedCase.startSituation}</CaseBlock>
            </div>}
            {narrationError && <p className="narration-error">{narrationError}</p>}
            <footer>
              {comicDetailsOpen && comicPanels.length > 0 && <button className="comic-details-link" onClick={() => setComicDetailsOpen(false)}>← Вернуться к комиксу</button>}
              <span>Голос: {voiceMode === "female" ? "Marin" : "Cedar"}</span>
              <button className={`narration-button ${narrationStatus === "playing" ? "playing" : ""}`} onClick={() => void toggleNarration()}>
                {narrationStatus === "loading" ? "ГОТОВИМ АУДИО…" : narrationStatus === "playing" ? "■ ОСТАНОВИТЬ" : "▶ ОЗВУЧИТЬ"}
              </button>
            </footer>
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

function RoleSelect({ selectedCase, value, onChange, disabled }: { selectedCase: CanonicalCase; value: number; onChange: (value: number) => void; disabled: boolean }) {
  const roles = [selectedCase.userRole, selectedCase.opponentRole, ...(selectedCase.additionalRoles || [])];
  return (
    <label className="setting-group case-select-control">
      <span className="setting-label">ВАША РОЛЬ</span>
      <span className="case-select-shell"><b>♙</b><select value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} aria-label="Ваша роль">{roles.map((role, index) => <option value={index} key={role.name}>{role.name}</option>)}</select><i>⌄</i></span>
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
