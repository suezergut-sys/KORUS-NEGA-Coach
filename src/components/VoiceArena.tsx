"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import AppNavRail from "@/components/AppNavRail";
import CaseAddedNotice from "@/components/CaseAddedNotice";
import CaseNegotiationPairs from "@/components/CaseNegotiationPairs";
import CaseVisibilityPicker from "@/components/CaseVisibilityPicker";
import type { CanonicalCase } from "@/lib/case-types";
import { opponentPortraitForRole } from "@/lib/opponent-portrait";
import { shouldEnableMicrophone, type NegotiationInputMode } from "@/lib/negotiation-input-mode";
import { DEFAULT_CASE } from "@/lib/default-case";
import type { NegotiationHint } from "@/lib/hint-types";
import { validateUploadSelection } from "@/lib/case-upload-constraints";
import type { CaseVisibility } from "@/lib/case-visibility";
import { cycleOpponentIndex, opponentIndicesForRole } from "@/lib/case-negotiation-pairs";
import { consumeCaseAddedNotice } from "@/lib/case-approval-navigation";
import { realtimeResponseStatus, shouldMonitorRealtimeResponseStall, shouldRecoverRealtimeResponse } from "@/lib/realtime-diagnostics";
import { DEFAULT_METHODOLOGY_ID, getMethodology, methodologyOptions, type MethodologyId } from "@/lib/methodologies";
import NegotiationReport from "@/components/NegotiationReport";
import { useNegotiationMachine } from "@/hooks/useNegotiationMachine";
import { useNegotiationTranscript, type TranscriptLine as Line } from "@/hooks/useNegotiationTranscript";
import { useNegotiationTimer } from "@/hooks/useNegotiationTimer";
import { useNegotiationReport } from "@/hooks/useNegotiationReport";
import { useCaseComic } from "@/hooks/useCaseComic";
import { useCaseNarration } from "@/hooks/useCaseNarration";
import { bargeInRealtime, closeRealtimeConnection, fetchWithTimeout, pauseRealtime, requestRealtimeResponse, resumeRealtime, updateTurnDetection, waitForDataChannelOpen } from "@/lib/realtime-webrtc";
import {
  evaluateUserTurn,
  INCOMPLETE_TURN_CLARIFICATION_DELAY_MS,
  INCOMPLETE_TURN_CLARIFICATION_INSTRUCTIONS,
  shouldContinueOpponentAfterPause,
} from "@/lib/realtime-turn-gate";
import {
  applyOutputAudioBufferEvent,
  EMPTY_OUTPUT_AUDIO_BUFFER_TIMING,
  flushOutputAudioBufferTiming,
  type OutputAudioBufferTimingState,
} from "@/lib/output-audio-buffer-timing";
import { completedResponsePauseMs } from "@/lib/speech-timing";
import {
  INTERRUPTION_TRANSCRIPT_CONFIRMATION_DELAY_MS,
  isMeaningfulUserSpeechTranscript,
  shouldConfirmRealtimeInterruption,
  type RealtimeInterruptionCandidate,
} from "@/lib/realtime-interruption";
import {
  completePendingSpeechItem,
  shouldReplaceActiveResponseForLateTranscript,
} from "@/lib/realtime-turn-coordination";
import {
  buildOpponentEmotionInstructions,
  createInitialOpponentEmotion,
  updateOpponentEmotion,
} from "@/lib/opponent-emotion";
import { FIRST_OPPONENT_TURN_INSTRUCTIONS } from "@/lib/realtime-language";
import {
  acquireVoiceEvalInputStream,
  realtimeEventVoiceEvalDetails,
  recordVoiceEval,
} from "@/lib/voice-eval";
import {
  fitPanelWidths,
  MIN_COMPACT_CONVERSATION_WIDTH,
  MIN_OPPONENT_PANEL_WIDTH,
  MIN_SETTINGS_PANEL_WIDTH,
  MIN_WIDE_CONVERSATION_WIDTH,
  resizePanels,
  type PanelWidths,
  type ResizablePanel,
} from "@/lib/panel-resize";

type VoiceMode = "female" | "male";
type NegotiationStyle = "collaborative" | "hard";
type DurationMinutes = 3 | 5 | 10 | 15;
type EndReason = "user" | "timer";
type HintStatus = "idle" | "loading" | "ready" | "error";

const OPPONENTS = {
  female: {
    name: "Марина Волкова",
    title: "Директор по закупкам",
    voice: "marin",
    style: "Рациональна, внимательна к рискам, ценит конкретику",
  },
  male: {
    name: "Алексей Крылов",
    title: "Директор по закупкам",
    voice: "cedar",
    style: "Сдержан, требователен к фактам, защищает условия сделки",
  },
} as const;

const WAVE_BARS = [22, 32, 18, 42, 29, 58, 35, 72, 43, 88, 52, 66, 36, 79, 46, 61, 28, 49, 33, 24];
const DURATION_OPTIONS: DurationMinutes[] = [3, 5, 10, 15];
const TIME_EXPIRED_MESSAGE = "Время переговоров истекло. Запускаем анализ поединка для определения победителя.";
const PANEL_WIDTHS_STORAGE_KEY = "korus-nega-panel-widths-v1";
const MIN_RESIZABLE_VIEWPORT_WIDTH = 1200;

function roleVoiceGender(role: CanonicalCase["userRole"]): VoiceMode {
  if (role.voiceGender === "female" || role.voiceGender === "male") return role.voiceGender;
  const firstName = role.name.trim().split(/\s+/)[0].toLowerCase();
  return /[ая]$/.test(firstName) ? "female" : "male";
}
function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function VoiceArena({
  isAdministrator = false,
  voiceEvalMode = false,
}: {
  isAdministrator?: boolean;
  voiceEvalMode?: boolean;
}) {
  const {
    state: lifecycleState,
    dispatch: lifecycleDispatch,
    isActive: isLive,
    isPaused,
    isEnding,
  } = useNegotiationMachine();
  const transcript = useNegotiationTranscript();
  const { lines, linesRef, transcriptEndRef, setLines, replaceLine, appendDelta, clockTime } = transcript;
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("male");
  const [negotiationStyle, setNegotiationStyle] = useState<NegotiationStyle>("collaborative");
  const [durationMinutes, setDurationMinutes] = useState<DurationMinutes>(5);
  const [inputMode, setInputMode] = useState<NegotiationInputMode>("duplex");
  const [methodologyId, setMethodologyId] = useState<MethodologyId>(DEFAULT_METHODOLOGY_ID);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [error, setError] = useState("");
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState("");
  const [hintStatus, setHintStatus] = useState<HintStatus>("idle");
  const [hint, setHint] = useState<NegotiationHint | null>(null);
  const [hintError, setHintError] = useState("");
  const [hintUsed, setHintUsed] = useState(false);
  const [cases, setCases] = useState<CanonicalCase[]>([DEFAULT_CASE]);
  const [selectedCaseId, setSelectedCaseId] = useState(DEFAULT_CASE.id);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [opponentRoleIndex, setOpponentRoleIndex] = useState(1);
  const [casesError, setCasesError] = useState("");
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [quickVisibility, setQuickVisibility] = useState<CaseVisibility>("public");
  const [quickStatus, setQuickStatus] = useState<"idle" | "loading" | "error">("idle");
  const [quickError, setQuickError] = useState("");
  const [caseContentOpen, setCaseContentOpen] = useState(false);
  const [panelWidths, setPanelWidths] = useState<PanelWidths | null>(null);
  const [resizingPanel, setResizingPanel] = useState<ResizablePanel | null>(null);
  const [caseAddedNotice, setCaseAddedNotice] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const notice = consumeCaseAddedNotice(url);
    const quickUploadRequested = url.searchParams.get("quickUpload") === "1";
    if (!notice.shouldShow && !quickUploadRequested) return;

    if (quickUploadRequested) url.searchParams.delete("quickUpload");
    const timer = window.setTimeout(() => {
      if (notice.shouldShow) setCaseAddedNotice(true);
      if (quickUploadRequested) setQuickUploadOpen(true);
    }, 0);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return () => window.clearTimeout(timer);
  }, []);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const pausedRef = useRef(false);
  const inputModeRef = useRef<NegotiationInputMode>("duplex");
  const pushToTalkActiveRef = useRef(false);
  const endingRef = useRef(false);
  const hintUsedRef = useRef(false);
  const endSessionRef = useRef<(reason?: EndReason) => Promise<void>>(async () => undefined);
  const opponentTurnCountRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const trainingSessionIdRef = useRef("");
  const startPendingRef = useRef(false);
  const quickUploadPendingRef = useRef(false);
  const hintPendingRef = useRef(false);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);
  const diagnosticSessionIdRef = useRef("");
  const userSpeakingRef = useRef(false);
  const opponentSpeakingRef = useRef(false);
  const activeResponseIdRef = useRef("");
  const responseInProgressRef = useRef(false);
  const currentAssistantItemIdRef = useRef("");
  const pausedOpponentRef = useRef<{ lineId: string; wasAudible: boolean; mergeTranscript: boolean } | null>(null);
  const continuationRequestedRef = useRef(false);
  const continuationResponseIdRef = useRef("");
  const continuationTargetLineIdRef = useRef("");
  const continuationMergeTranscriptRef = useRef(false);
  const continuationDeltaSeenRef = useRef(false);
  const responseStartedAtRef = useRef(0);
  const lastOpponentDeltaAtRef = useRef(0);
  const userTranscriptVersionRef = useRef(0);
  const pendingUserFragmentsRef = useRef<string[]>([]);
  const pendingSpeechItemIdsRef = useRef<Set<string>>(new Set());
  const incompleteTurnTimerRef = useRef<number | null>(null);
  const queuedUserResponseRef = useRef<{ instructions?: string } | null>(null);
  const interruptedResponseRef = useRef<{ responseId: string; transcriptVersion: number } | null>(null);
  const interruptionCandidateRef = useRef<RealtimeInterruptionCandidate | null>(null);
  const interruptionConfirmationTimerRef = useRef<number | null>(null);
  const bargeInSentAtRef = useRef(0);
  const userTurnInterruptedOpponentRef = useRef(false);
  const opponentEmotionRef = useRef(createInitialOpponentEmotion("collaborative"));
  const recoveryTimerRef = useRef<number | null>(null);
  const recoveryPendingRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const disconnectedTimerRef = useRef<number | null>(null);
  const setupStartedAtRef = useRef(0);
  const setupLatencyMsRef = useRef(0);
  const userSpeechStoppedAtRef = useRef(0);
  const replyLatenciesMsRef = useRef<number[]>([]);
  const recoveryCountRef = useRef(0);
  const interruptionCountRef = useRef(0);
  const connectionErrorCountRef = useRef(0);
  const userSpeechStartedAtRef = useRef(0);
  const opponentSpeechStartedAtRef = useRef(0);
  const lastOpponentSpeechEndedAtRef = useRef(0);
  const opponentPlaybackTimingRef = useRef<OutputAudioBufferTimingState>(EMPTY_OUTPUT_AUDIO_BUFFER_TIMING);
  const userSpeakingDurationsMsRef = useRef<number[]>([]);
  const opponentSpeakingDurationsMsRef = useRef<number[]>([]);
  const userResponseTimesMsRef = useRef<number[]>([]);
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const conversationPanelRef = useRef<HTMLElement | null>(null);
  const opponentPanelRef = useRef<HTMLElement | null>(null);
  const panelDragRef = useRef<{
    panel: ResizablePanel;
    startX: number;
    widths: PanelWidths;
    conversationWidth: number;
  } | null>(null);

  const report = useNegotiationReport({
    methodologyId,
    onAnalyze: () => lifecycleDispatch({ type: "ANALYZE" }),
    onComplete: () => lifecycleDispatch({ type: "COMPLETE" }),
  });
  const {
    status: analysisStatus,
    analysis,
    error: analysisError,
    sessionId: analysisSessionId,
    canRetry: canRetryAnalysis,
    analysisMethodologyId,
    speechAnalytics,
    analysisRef,
    analyze: persistAndAnalyze,
    retry: retryAnalysis,
    applyReanalysis,
    reset: resetReport,
  } = report;

  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0] || DEFAULT_CASE;
  const allRoles = [selectedCase.userRole, selectedCase.opponentRole, ...(selectedCase.additionalRoles || [])];
  const participantRole = allRoles[selectedRoleIndex] || allRoles[0];
  const allowedOpponentIndices = opponentIndicesForRole(selectedCase, selectedRoleIndex);
  const effectiveOpponentRoleIndex = allowedOpponentIndices.includes(opponentRoleIndex) ? opponentRoleIndex : allowedOpponentIndices[0];
  const aiRole = allRoles[effectiveOpponentRoleIndex] || allRoles[0];
  const voiceProfile = OPPONENTS[voiceMode];
  const opponent = {
    ...voiceProfile,
    name: aiRole.name,
    title: aiRole.position,
    image: opponentPortraitForRole(aiRole),
  };
  const comic = useCaseComic(selectedCase, selectedRoleIndex);
  const {
    panels: comicPanels,
    activePanel: activeComicPanel,
    mediaStatus: comicMediaStatus,
    panelIndex: comicPanelIndex,
    setPanelIndex: setComicPanelIndex,
    detailsOpen: comicDetailsOpen,
    setDetailsOpen: setComicDetailsOpen,
    error: comicError,
    reset: resetComic,
  } = comic;
  const narration = useCaseNarration({
    caseId: selectedCase.id,
    participantRoleIndex: selectedRoleIndex,
    opponentRoleIndex: effectiveOpponentRoleIndex,
    opponentVoice: opponent.voice,
    voiceMode,
    panels: comicPanels,
    panelIndex: comicPanelIndex,
    setPanelIndex: setComicPanelIndex,
    modalOpen: caseContentOpen,
  });
  const {
    status: narrationStatus,
    error: narrationError,
    stop: stopNarration,
    toggle: toggleNarration,
  } = narration;
  const isBusy = lifecycleState.phase === "connecting";
  const isDuelMode = isBusy || isLive || isEnding;
  const isSettingsCollapsed = isDuelMode && settingsCollapsed;
  const totalDurationSeconds = durationMinutes * 60;

  const reportRealtimeDiagnostic = useCallback((event: string, details: Record<string, string | number | boolean | null> = {}) => {
    if (!diagnosticSessionIdRef.current) return;
    recordVoiceEval(voiceEvalMode, "diagnostic", event, details);
    if (voiceEvalMode) return;
    void fetch("/api/realtime/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: diagnosticSessionIdRef.current, caseId: selectedCase.id, event, details }),
      keepalive: true,
    }).catch(() => undefined);
  }, [selectedCase.id, voiceEvalMode]);

  const clearIncompleteTurnTimer = useCallback(() => {
    if (incompleteTurnTimerRef.current) window.clearTimeout(incompleteTurnTimerRef.current);
    incompleteTurnTimerRef.current = null;
  }, []);

  const clearInterruptionConfirmationTimer = useCallback(() => {
    if (interruptionConfirmationTimerRef.current) window.clearTimeout(interruptionConfirmationTimerRef.current);
    interruptionConfirmationTimerRef.current = null;
  }, []);

  const requestOpponentResponse = useCallback((instructions?: string) => {
    if (endingRef.current || pausedRef.current) return false;
    if (responseInProgressRef.current) {
      queuedUserResponseRef.current = { instructions };
      return false;
    }
    queuedUserResponseRef.current = null;
    return requestRealtimeResponse(channelRef.current, instructions);
  }, []);

  const waitForUserTurnContinuation = useCallback(() => {
    clearIncompleteTurnTimer();
    incompleteTurnTimerRef.current = window.setTimeout(() => {
      incompleteTurnTimerRef.current = null;
      if (endingRef.current || pausedRef.current || userSpeakingRef.current) return;
      pendingUserFragmentsRef.current = [];
      userTurnInterruptedOpponentRef.current = false;
      requestOpponentResponse(INCOMPLETE_TURN_CLARIFICATION_INSTRUCTIONS);
      reportRealtimeDiagnostic("turn_gate_clarification", { delayMs: INCOMPLETE_TURN_CLARIFICATION_DELAY_MS });
    }, INCOMPLETE_TURN_CLARIFICATION_DELAY_MS);
  }, [clearIncompleteTurnTimer, reportRealtimeDiagnostic, requestOpponentResponse]);

  const syncMicrophoneTrack = useCallback(() => {
    const enabled = shouldEnableMicrophone(inputModeRef.current, pausedRef.current, pushToTalkActiveRef.current);
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = enabled; });
  }, []);

  const applyMediaPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    if (paused) {
      pushToTalkActiveRef.current = false;
      setPushToTalkActive(false);
    }
    syncMicrophoneTrack();
    if (paused) {
      audioRef.current?.pause();
      setUserSpeaking(false);
      setOpponentSpeaking(false);
      return;
    }
    const audio = audioRef.current;
    if (audio) {
      void audio.play().catch(() => undefined);
    }
  }, [syncMicrophoneTrack]);

  const restoreRealtimeAfterPause = useCallback(() => {
    const interrupted = pausedOpponentRef.current;
    continuationRequestedRef.current = Boolean(interrupted);
    continuationResponseIdRef.current = "";
    continuationTargetLineIdRef.current = interrupted?.lineId || "";
    continuationMergeTranscriptRef.current = interrupted?.mergeTranscript || false;
    continuationDeltaSeenRef.current = false;
    resumeRealtime(channelRef.current, {
      eagerness: negotiationStyle === "hard" ? "high" : "low",
      continueOpponent: Boolean(interrupted),
      opponentWasAudible: interrupted?.wasAudible || false,
    });
    pausedOpponentRef.current = null;
    reportRealtimeDiagnostic("pause_resumed", { continuedOpponent: Boolean(interrupted) });
  }, [negotiationStyle, reportRealtimeDiagnostic]);

  const timer = useNegotiationTimer({
    active: isLive,
    paused: isPaused,
    ending: isEnding,
    totalSeconds: totalDurationSeconds,
    onExpire: () => void endSessionRef.current("timer"),
    onPause: () => applyMediaPaused(true),
    onResume: () => {
      restoreRealtimeAfterPause();
      applyMediaPaused(false);
      lifecycleDispatch({ type: "RESUME" });
    },
  });
  const {
    pauseRemaining,
    pauseUsed,
    remainingSeconds,
    start: startTimer,
    reset: resetTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    freeze: freezeTimer,
  } = timer;

  const setPushToTalkCapture = useCallback((active: boolean) => {
    pushToTalkActiveRef.current = active;
    setPushToTalkActive(active);
    syncMicrophoneTrack();
  }, [syncMicrophoneTrack]);

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

  const loadCases = useCallback(async (preferredId?: string) => {
    if (voiceEvalMode) {
      setCases([DEFAULT_CASE]);
      setSelectedCaseId(DEFAULT_CASE.id);
      setOpponentRoleIndex(1);
      setVoiceMode("male");
      setCasesError("");
      return;
    }
    try {
      const response = await fetch("/api/cases", { cache: "no-store" });
      const payload = (await response.json()) as { cases?: CanonicalCase[]; error?: string };
      if (!response.ok || !payload.cases?.length) throw new Error(payload.error || "База кейсов пока недоступна.");
      setCases(payload.cases);
      const queryId = preferredId || new URLSearchParams(window.location.search).get("case") || "";
      const nextCase = payload.cases.find((item) => item.id === queryId) || payload.cases[0];
      setSelectedCaseId(nextCase.id);
      const nextRoles = [nextCase.userRole, nextCase.opponentRole, ...(nextCase.additionalRoles || [])];
      const nextOpponentIndex = opponentIndicesForRole(nextCase, 0)[0] ?? 1;
      setOpponentRoleIndex(nextOpponentIndex);
      const nextAiRole = nextRoles[nextOpponentIndex];
      setVoiceMode(roleVoiceGender(nextAiRole));
      setSelectedRoleIndex(0);
      setCasesError("");
    } catch (caught) {
      setCasesError(caught instanceof Error ? caught.message : "Не удалось загрузить кейсы.");
    }
  }, [voiceEvalMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCases(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCases]);

  function chooseCase(caseId: string) {
    if (isLive || isBusy) return;
    stopNarration();
    setSelectedCaseId(caseId);
    resetComic();
    setSelectedRoleIndex(0);
    const nextCase = cases.find((item) => item.id === caseId);
    const nextRoles = nextCase ? [nextCase.userRole, nextCase.opponentRole, ...(nextCase.additionalRoles || [])] : [];
    const nextOpponentIndex = nextCase ? opponentIndicesForRole(nextCase, 0)[0] ?? 1 : 0;
    setOpponentRoleIndex(nextOpponentIndex);
    if (nextCase) {
      const nextAiRole = nextRoles[nextOpponentIndex];
      setVoiceMode(roleVoiceGender(nextAiRole));
    }
    setLines([]);
    resetReport();
    lifecycleDispatch({ type: "RESET" });
    const url = new URL(window.location.href);
    url.searchParams.set("case", caseId);
    window.history.replaceState(null, "", url);
  }

  function chooseRole(index: number) {
    if (isLive || isBusy) return;
    stopNarration();
    resetComic();
    setSelectedRoleIndex(index);
    const nextOpponentIndex = opponentIndicesForRole(selectedCase, index)[0] ?? 0;
    setOpponentRoleIndex(nextOpponentIndex);
    const nextAiRole = allRoles[nextOpponentIndex];
    setVoiceMode(roleVoiceGender(nextAiRole));
    setLines([]);
    resetReport();
    lifecycleDispatch({ type: "RESET" });
  }

  function chooseAdjacentOpponent(direction: -1 | 1) {
    if (isLive || isBusy || allowedOpponentIndices.length < 2) return;
    stopNarration();
    const nextOpponentIndex = cycleOpponentIndex(allowedOpponentIndices, opponentRoleIndex, direction);
    setOpponentRoleIndex(nextOpponentIndex);
    setVoiceMode(roleVoiceGender(allRoles[nextOpponentIndex]));
    setLines([]);
    resetReport();
    lifecycleDispatch({ type: "RESET" });
  }

  function chooseInputMode(mode: NegotiationInputMode) {
    if (isLive || isBusy) return;
    inputModeRef.current = mode;
    setInputMode(mode);
    setPushToTalkCapture(false);
  }

  function beginPushToTalk() {
    if (inputMode !== "push_to_talk" || !isLive || isPaused || isEnding) return;
    setPushToTalkCapture(true);
  }

  async function uploadQuickCase() {
    if (!quickFile || quickUploadPendingRef.current) return;
    quickUploadPendingRef.current = true;
    setQuickStatus("loading");
    setQuickError("");
    try {
      const form = new FormData();
      form.set("file", quickFile);
      form.set("visibility", quickVisibility);
      const response = await fetch("/api/cases/quick-upload", { method: "POST", body: form });
      const payload = (await response.json()) as { case?: CanonicalCase; error?: string };
      if (!response.ok || !payload.case) throw new Error(payload.error || "Не удалось подготовить кейс.");
      await loadCases(payload.case.id);
      setQuickStatus("idle");
      setQuickFile(null);
      if (quickFileInputRef.current) quickFileInputRef.current.value = "";
      setQuickUploadOpen(false);
      setLines([{ id: crypto.randomUUID(), author: "Система", text: `Кейс «${payload.case.title}» добавлен и выбран. Изображения и озвучка появятся не сразу: они генерируются в фоне и могут потребовать несколько минут.`, time: clockTime() }]);
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

  const applyOpponentPlaybackEvent = useCallback((
    type: "started" | "stopped" | "cleared",
    responseId: string,
    at = Date.now(),
  ) => {
    if (inputModeRef.current !== "duplex") return;
    const result = applyOutputAudioBufferEvent(opponentPlaybackTimingRef.current, { type, responseId, at });
    opponentPlaybackTimingRef.current = result.state;
    if (result.durationMs !== null) opponentSpeakingDurationsMsRef.current.push(result.durationMs);

    if (result.started) {
      opponentSpeechStartedAtRef.current = at;
      lastOpponentSpeechEndedAtRef.current = 0;
      if (userSpeechStoppedAtRef.current > 0) {
        replyLatenciesMsRef.current.push(Math.max(0, at - userSpeechStoppedAtRef.current));
        userSpeechStoppedAtRef.current = 0;
      }
      opponentSpeakingRef.current = true;
      setOpponentSpeaking(true);
    }
    if (result.stopped) {
      opponentSpeechStartedAtRef.current = 0;
      lastOpponentSpeechEndedAtRef.current = result.completedAt || 0;
      opponentSpeakingRef.current = false;
      setOpponentSpeaking(false);
    }
    reportRealtimeDiagnostic(`output_audio_buffer_${type}`, {
      responseId,
      durationMs: result.durationMs,
      completedResponse: result.completedAt !== null,
    });
  }, [reportRealtimeDiagnostic]);

  const flushOpponentPlayback = useCallback((stoppedAt = Date.now()) => {
    const result = flushOutputAudioBufferTiming(opponentPlaybackTimingRef.current, stoppedAt);
    opponentPlaybackTimingRef.current = result.state;
    if (result.durationMs !== null) opponentSpeakingDurationsMsRef.current.push(result.durationMs);
    opponentSpeechStartedAtRef.current = 0;
    opponentSpeakingRef.current = false;
    setOpponentSpeaking(false);
  }, []);

  const closeSession = useCallback((resetLifecycle = true) => {
    if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
    if (disconnectedTimerRef.current) window.clearTimeout(disconnectedTimerRef.current);
    clearIncompleteTurnTimer();
    clearInterruptionConfirmationTimer();
    flushOpponentPlayback();
    closeRealtimeConnection({
      channel: channelRef.current,
      peer: peerRef.current,
      stream: streamRef.current,
      audio: audioRef.current,
    });
    window.speechSynthesis?.cancel();
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    pausedRef.current = false;
    pushToTalkActiveRef.current = false;
    userSpeakingRef.current = false;
    opponentSpeakingRef.current = false;
    activeResponseIdRef.current = "";
    responseInProgressRef.current = false;
    currentAssistantItemIdRef.current = "";
    pausedOpponentRef.current = null;
    continuationRequestedRef.current = false;
    continuationResponseIdRef.current = "";
    continuationTargetLineIdRef.current = "";
    continuationMergeTranscriptRef.current = false;
    continuationDeltaSeenRef.current = false;
    responseStartedAtRef.current = 0;
    lastOpponentDeltaAtRef.current = 0;
    interruptedResponseRef.current = null;
    interruptionCandidateRef.current = null;
    bargeInSentAtRef.current = 0;
    if (audioRef.current) audioRef.current.muted = false;
    pendingUserFragmentsRef.current = [];
    pendingSpeechItemIdsRef.current = new Set();
    queuedUserResponseRef.current = null;
    recoveryTimerRef.current = null;
    recoveryPendingRef.current = false;
    disconnectedTimerRef.current = null;
    resetTimer();
    setSettingsCollapsed(false);
    setUserSpeaking(false);
    setOpponentSpeaking(false);
    setPushToTalkActive(false);
    setRealtimeNotice("");
    if (resetLifecycle) lifecycleDispatch({ type: "RESET" });
  }, [clearIncompleteTurnTimer, clearInterruptionConfirmationTimer, flushOpponentPlayback, lifecycleDispatch, resetTimer]);

  useEffect(() => () => closeSession(), [closeSession]);
  useEffect(() => () => stopNarration(), [stopNarration]);
  useEffect(() => {
    const release = () => setPushToTalkCapture(false);
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [setPushToTalkCapture]);

  const scheduleResponseRecovery = useCallback((reason: string, responseId: string, transcriptVersion: number, delayMs = 3500) => {
    if (recoveryPendingRef.current || endingRef.current || pausedRef.current) return;
    recoveryPendingRef.current = true;
    reportRealtimeDiagnostic("recovery_scheduled", { reason, responseId, delayMs });
    if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      const channel = channelRef.current;
      const aNewResponseStarted = Boolean(activeResponseIdRef.current && activeResponseIdRef.current !== responseId);
      const userActuallySpoke = userTranscriptVersionRef.current !== transcriptVersion;
      const shouldRecover = shouldRecoverRealtimeResponse({
        transcriptVersionAtInterruption: transcriptVersion,
        currentTranscriptVersion: userTranscriptVersionRef.current,
        userSpeaking: userSpeakingRef.current,
        newResponseStarted: aNewResponseStarted,
      });
      if (endingRef.current || pausedRef.current || !shouldRecover || channel?.readyState !== "open") {
        recoveryPendingRef.current = false;
        reportRealtimeDiagnostic("recovery_skipped", { reason, userActuallySpoke, aNewResponseStarted, channelState: channel?.readyState || "missing" });
        return;
      }
      if (recoveryAttemptsRef.current >= 2) {
        recoveryPendingRef.current = false;
        setRealtimeNotice("Ответ оппонента прервался повторно. Проверьте соединение или завершите поединок для анализа.");
        reportRealtimeDiagnostic("recovery_skipped", { reason: "attempt_limit", attempts: recoveryAttemptsRef.current });
        return;
      }
      recoveryAttemptsRef.current += 1;
      recoveryCountRef.current += 1;
      activeResponseIdRef.current = "";
      opponentSpeakingRef.current = false;
      setOpponentSpeaking(false);
      setRealtimeNotice("Обнаружен обрыв ответа — оппонент продолжает с места остановки…");
      requestRealtimeResponse(
        channel,
        "Продолжи последнюю оборванную реплику с места остановки. Не повторяй уже сказанное и сохрани текущую роль и позицию в переговорах.",
      );
      reportRealtimeDiagnostic("recovery_triggered", { reason, attempt: recoveryAttemptsRef.current });
    }, delayMs);
  }, [reportRealtimeDiagnostic]);

  const handleEvent = useCallback((raw: MessageEvent<string>) => {
    try {
      const event = JSON.parse(raw.data) as Record<string, unknown>;
      const type = String(event.type || "");
      if (type !== "response.output_audio.delta") {
        recordVoiceEval(voiceEvalMode, "realtime", type, realtimeEventVoiceEvalDetails(event));
      }
      const itemId = String(event.item_id || event.response_id || crypto.randomUUID());
      if (pausedRef.current) return;

      if (type === "response.created") {
        if (audioRef.current) audioRef.current.muted = false;
        const response = (event.response && typeof event.response === "object" ? event.response : {}) as Record<string, unknown>;
        activeResponseIdRef.current = String(response.id || event.response_id || "");
        responseInProgressRef.current = true;
        currentAssistantItemIdRef.current = "";
        if (continuationRequestedRef.current) {
          continuationResponseIdRef.current = activeResponseIdRef.current;
          continuationRequestedRef.current = false;
        }
        responseStartedAtRef.current = Date.now();
        lastOpponentDeltaAtRef.current = Date.now();
        recoveryPendingRef.current = false;
        interruptedResponseRef.current = null;
      }
      if (type === "response.output_item.added") {
        const item = (event.item && typeof event.item === "object" ? event.item : {}) as Record<string, unknown>;
        if (String(item.type || "") === "message") currentAssistantItemIdRef.current = String(item.id || "");
      }
      if (type === "input_audio_buffer.speech_started") {
        clearIncompleteTurnTimer();
        pendingSpeechItemIdsRef.current.add(itemId);
        const speechStartedAt = Date.now();
        const opponentIsAudible = inputModeRef.current === "duplex"
          ? opponentSpeechStartedAtRef.current > 0
          : opponentSpeakingRef.current;
        if (inputModeRef.current === "duplex") {
          if (!userSpeechStartedAtRef.current) userSpeechStartedAtRef.current = speechStartedAt;
          const responsePauseMs = completedResponsePauseMs({
            opponentAudible: opponentIsAudible,
            opponentEndedAt: lastOpponentSpeechEndedAtRef.current,
            userStartedAt: speechStartedAt,
          });
          if (responsePauseMs !== null) {
            userResponseTimesMsRef.current.push(responsePauseMs);
            reportRealtimeDiagnostic("response_pause_recorded", { pauseMs: responsePauseMs });
            lastOpponentSpeechEndedAtRef.current = 0;
          }
        }
        userSpeakingRef.current = true;
        setUserSpeaking(true);
        const responseIsActive = responseInProgressRef.current;
        if (opponentIsAudible || responseIsActive) {
          clearInterruptionConfirmationTimer();
          const responseId = activeResponseIdRef.current || opponentPlaybackTimingRef.current.responseId;
          const audioEndMs = opponentIsAudible
            ? Math.max(0, speechStartedAt - opponentSpeechStartedAtRef.current - 100)
            : undefined;
          if (audioRef.current) audioRef.current.muted = true;
          const stopRequested = bargeInRealtime(channelRef.current, {
            responseActive: responseIsActive,
            opponentPlaybackActive: opponentIsAudible,
            assistantItemId: currentAssistantItemIdRef.current,
            audioEndMs,
          });
          bargeInSentAtRef.current = opponentIsAudible && stopRequested ? speechStartedAt : 0;
          const candidate = {
            itemId,
            responseId,
            transcriptVersion: userTranscriptVersionRef.current,
            startedAt: speechStartedAt,
            durationMs: null,
            wasAudible: opponentIsAudible,
          };
          interruptionCandidateRef.current = candidate;
          interruptedResponseRef.current = candidate;
          reportRealtimeDiagnostic("speech_started", { duringOpponent: opponentIsAudible, responseId });
          reportRealtimeDiagnostic("barge_in_sent", {
            responseId,
            responseActive: responseIsActive,
            opponentAudible: opponentIsAudible,
            stopRequested,
          });
        }
      }
      if (type === "input_audio_buffer.speech_stopped") {
        const speechStoppedAt = Date.now();
        if (inputModeRef.current === "duplex" && userSpeechStartedAtRef.current) {
          const durationMs = Math.max(0, speechStoppedAt - userSpeechStartedAtRef.current);
          if (interruptionCandidateRef.current?.itemId === itemId) interruptionCandidateRef.current.durationMs = durationMs;
          else userSpeakingDurationsMsRef.current.push(durationMs);
          userSpeechStartedAtRef.current = 0;
        }
        userSpeakingRef.current = false;
        userSpeechStoppedAtRef.current = speechStoppedAt;
        setUserSpeaking(false);
        const candidate = interruptionCandidateRef.current?.itemId === itemId
          ? interruptionCandidateRef.current
          : null;
        if (candidate) {
          reportRealtimeDiagnostic("speech_stopped", { afterInterruption: true });
          clearInterruptionConfirmationTimer();
          interruptionConfirmationTimerRef.current = window.setTimeout(() => {
            interruptionConfirmationTimerRef.current = null;
            if (interruptionCandidateRef.current !== candidate) return;
            interruptionCandidateRef.current = null;
            pendingSpeechItemIdsRef.current.delete(candidate.itemId);
            reportRealtimeDiagnostic("noise_ignored", {
              reason: "no_meaningful_transcript",
              durationMs: candidate.durationMs,
            });
            scheduleResponseRecovery(
              "noise_without_transcript",
              candidate.responseId,
              candidate.transcriptVersion,
              250,
            );
          }, INTERRUPTION_TRANSCRIPT_CONFIRMATION_DELAY_MS);
        }
      }
      if (type === "output_audio_buffer.started") {
        if (audioRef.current) audioRef.current.muted = false;
        applyOpponentPlaybackEvent("started", String(event.response_id || ""), Date.now());
      }
      if (type === "output_audio_buffer.stopped" || type === "output_audio_buffer.cleared") {
        const stoppedAt = Date.now();
        applyOpponentPlaybackEvent(
          type === "output_audio_buffer.stopped" ? "stopped" : "cleared",
          String(event.response_id || ""),
          stoppedAt,
        );
        if (bargeInSentAtRef.current) {
          reportRealtimeDiagnostic("barge_in_stop_confirmed", {
            responseId: String(event.response_id || ""),
            latencyMs: Math.max(0, stoppedAt - bargeInSentAtRef.current),
          });
          bargeInSentAtRef.current = 0;
        }
      }
      if (type === "response.output_audio.delta" || type === "response.output_audio_transcript.delta") {
        const opponentStartedAt = Date.now();
        if (inputModeRef.current !== "duplex") {
          if (!opponentSpeakingRef.current && userSpeechStoppedAtRef.current > 0) {
            replyLatenciesMsRef.current.push(Math.max(0, opponentStartedAt - userSpeechStoppedAtRef.current));
            userSpeechStoppedAtRef.current = 0;
          }
          opponentSpeakingRef.current = true;
          setOpponentSpeaking(true);
        }
        lastOpponentDeltaAtRef.current = opponentStartedAt;
        setRealtimeNotice("");
      }
      if (type === "response.output_audio.done" || type === "response.output_audio_transcript.done") {
        if (inputModeRef.current !== "duplex") {
          opponentSpeakingRef.current = false;
          setOpponentSpeaking(false);
        }
      }
      if (type === "conversation.item.input_audio_transcription.delta") {
        appendDelta("Вы", String(event.delta || ""), itemId);
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = String(event.transcript || "").trim();
        const meaningfulTranscript = isMeaningfulUserSpeechTranscript(transcript);
        const candidate = interruptionCandidateRef.current?.itemId === itemId
          ? interruptionCandidateRef.current
          : null;
        const speechCompletion = completePendingSpeechItem(pendingSpeechItemIdsRef.current, itemId);
        pendingSpeechItemIdsRef.current = speechCompletion.remainingItemIds;
        const waitingForSiblingTranscript = speechCompletion.shouldWaitForSiblingTranscript;
        if (candidate) {
          clearInterruptionConfirmationTimer();
          interruptionCandidateRef.current = null;
        }
        if (candidate && meaningfulTranscript) {
          if (candidate.durationMs !== null) userSpeakingDurationsMsRef.current.push(candidate.durationMs);
          if (shouldConfirmRealtimeInterruption(candidate, transcript)) {
            interruptionCountRef.current += 1;
            userTurnInterruptedOpponentRef.current = true;
            reportRealtimeDiagnostic("interruption_confirmed", {
              responseId: candidate.responseId,
              durationMs: candidate.durationMs,
            });
          }
        } else if (candidate) {
          reportRealtimeDiagnostic("noise_ignored", {
            reason: transcript ? "non_speech_transcript" : "empty_transcript",
            durationMs: candidate.durationMs,
          });
          scheduleResponseRecovery(
            "noise_without_meaningful_transcript",
            candidate.responseId,
            candidate.transcriptVersion,
            250,
          );
        }
        if (meaningfulTranscript) {
          userTranscriptVersionRef.current += 1;
          const pendingCount = pendingUserFragmentsRef.current.length;
          const decision = evaluateUserTurn(pendingUserFragmentsRef.current, transcript);
          if (waitingForSiblingTranscript) {
            pendingUserFragmentsRef.current = [...pendingUserFragmentsRef.current, transcript];
            clearIncompleteTurnTimer();
            reportRealtimeDiagnostic("pending_transcription_wait", {
              fragmentCount: pendingCount + 1,
              pendingTranscriptions: pendingSpeechItemIdsRef.current.size,
            });
          } else if (decision.shouldRespond) {
            const completedTranscript = [...pendingUserFragmentsRef.current, transcript].join(" ");
            const emotionUpdate = updateOpponentEmotion(opponentEmotionRef.current, {
              transcript: completedTranscript,
              interruptedOpponent: userTurnInterruptedOpponentRef.current,
              style: negotiationStyle,
            });
            const previousTone = opponentEmotionRef.current.tone;
            opponentEmotionRef.current = emotionUpdate.state;
            userTurnInterruptedOpponentRef.current = false;
            pendingUserFragmentsRef.current = [];
            clearIncompleteTurnTimer();
            const responseWasInProgress = responseInProgressRef.current;
            const opponentWasAudible = opponentSpeakingRef.current;
            const replacePrematureResponse = shouldReplaceActiveResponseForLateTranscript({
              hasInterruptionCandidate: candidate !== null,
              responseInProgress: responseWasInProgress,
              opponentAudible: opponentWasAudible,
              waitingForSiblingTranscript,
            });
            if (replacePrematureResponse) {
              const replacementRequestedAt = Date.now();
              if (audioRef.current) audioRef.current.muted = true;
              bargeInRealtime(channelRef.current, {
                responseActive: responseWasInProgress,
                opponentPlaybackActive: opponentWasAudible,
                assistantItemId: currentAssistantItemIdRef.current,
                audioEndMs: opponentWasAudible
                  ? Math.max(0, replacementRequestedAt - opponentSpeechStartedAtRef.current - 100)
                  : undefined,
              });
              reportRealtimeDiagnostic("late_transcript_replaced_response", {
                responseId: activeResponseIdRef.current || opponentPlaybackTimingRef.current.responseId,
                responseActive: responseWasInProgress,
                opponentAudible: opponentWasAudible,
              });
            }
            const directiveSent = requestOpponentResponse(buildOpponentEmotionInstructions(emotionUpdate.state, emotionUpdate.triggers, selectedCase.addressForm));
            reportRealtimeDiagnostic("emotion_shift", {
              previousTone,
              tone: emotionUpdate.state.tone,
              trust: emotionUpdate.state.trust,
              tension: emotionUpdate.state.tension,
              irritation: emotionUpdate.state.irritation,
              dominance: emotionUpdate.state.dominance,
              engagement: emotionUpdate.state.engagement,
              triggerCount: emotionUpdate.triggers.length,
              interruption: emotionUpdate.triggers.includes("interruption"),
              directiveDelivery: directiveSent ? "sent" : responseWasInProgress ? "queued" : "failed",
            });
            reportRealtimeDiagnostic("turn_gate_released", { fragmentCount: pendingCount + 1 });
          } else {
            pendingUserFragmentsRef.current = [...pendingUserFragmentsRef.current, transcript];
            waitForUserTurnContinuation();
            reportRealtimeDiagnostic("turn_gate_waiting", { fragmentCount: pendingCount + 1 });
          }
        }
        if (meaningfulTranscript) replaceLine("Вы", transcript, itemId);
        else setLines((current) => current.filter((line) => line.id !== itemId));
      }
      if (type === "conversation.item.input_audio_transcription.failed") {
        const candidate = interruptionCandidateRef.current?.itemId === itemId
          ? interruptionCandidateRef.current
          : null;
        const speechCompletion = completePendingSpeechItem(pendingSpeechItemIdsRef.current, itemId);
        pendingSpeechItemIdsRef.current = speechCompletion.remainingItemIds;
        if (candidate) {
          clearInterruptionConfirmationTimer();
          interruptionCandidateRef.current = null;
          scheduleResponseRecovery(
            "transcription_failed_after_speech",
            candidate.responseId,
            candidate.transcriptVersion,
            250,
          );
        }
        setLines((current) => current.filter((line) => line.id !== itemId));
        if (!speechCompletion.shouldWaitForSiblingTranscript && pendingUserFragmentsRef.current.length > 0) {
          waitForUserTurnContinuation();
        }
        reportRealtimeDiagnostic("transcription_failed", {
          pendingTranscriptions: pendingSpeechItemIdsRef.current.size,
        });
      }
      if (type === "response.output_audio_transcript.delta") {
        const delta = String(event.delta || "");
        currentAssistantItemIdRef.current = String(event.item_id || currentAssistantItemIdRef.current);
        const isContinuation = Boolean(
          continuationResponseIdRef.current
          && String(event.response_id || "") === continuationResponseIdRef.current,
        );
        if (isContinuation && continuationTargetLineIdRef.current && continuationMergeTranscriptRef.current) {
          const targetId = continuationTargetLineIdRef.current;
          const target = linesRef.current.find((line) => line.id === targetId);
          const needsSpace = !continuationDeltaSeenRef.current
            && Boolean(target?.text)
            && !/\s$/.test(target?.text || "")
            && !/^[,.;:!?…)]/.test(delta);
          appendDelta("Оппонент", `${needsSpace ? " " : ""}${delta}`, targetId);
          continuationDeltaSeenRef.current = true;
        } else if (!isContinuation || !continuationTargetLineIdRef.current) {
          appendDelta("Оппонент", delta, itemId);
        }
      }
      if (type === "response.output_audio_transcript.done") {
        const transcript = String(event.transcript || "");
        const isContinuation = Boolean(
          continuationResponseIdRef.current
          && String(event.response_id || "") === continuationResponseIdRef.current,
        );
        if (isContinuation && continuationTargetLineIdRef.current && continuationMergeTranscriptRef.current) {
          if (!continuationDeltaSeenRef.current) {
            const targetId = continuationTargetLineIdRef.current;
            const target = linesRef.current.find((line) => line.id === targetId);
            const needsSpace = Boolean(target?.text) && !/\s$/.test(target?.text || "") && !/^[,.;:!?…)]/.test(transcript);
            appendDelta("Оппонент", `${needsSpace ? " " : ""}${transcript}`, targetId);
          }
        } else if (!isContinuation || !continuationTargetLineIdRef.current) {
          replaceLine("Оппонент", transcript, itemId);
        }
        if (negotiationStyle === "hard") {
          opponentTurnCountRef.current += 1;
          updateTurnDetection(channelRef.current, opponentTurnCountRef.current % 5 === 0 ? "high" : "low");
        }
      }
      if (type === "response.done") {
        const outcome = realtimeResponseStatus(event);
        const responseId = outcome.responseId || activeResponseIdRef.current;
        const responseDurationMs = responseStartedAtRef.current ? Date.now() - responseStartedAtRef.current : 0;
        if (inputModeRef.current !== "duplex") {
          opponentSpeakingRef.current = false;
          setOpponentSpeaking(false);
        }
        reportRealtimeDiagnostic("response_done", { ...outcome, responseDurationMs });
        if (outcome.status === "completed") {
          interruptedResponseRef.current = null;
          recoveryAttemptsRef.current = 0;
        } else if (outcome.status === "cancelled") {
          const interrupted = interruptedResponseRef.current;
          if (interrupted) scheduleResponseRecovery("cancelled_after_speech", responseId || interrupted.responseId, interrupted.transcriptVersion);
        } else if (outcome.status === "incomplete") {
          scheduleResponseRecovery(`incomplete_${outcome.reason || "unknown"}`, responseId, userTranscriptVersionRef.current, 1600);
        } else if (outcome.status === "failed") {
          setRealtimeNotice("OpenAI не завершил ответ оппонента. Попробуйте продолжить своей репликой или завершите поединок.");
        }
        responseInProgressRef.current = false;
        activeResponseIdRef.current = "";
        if (continuationResponseIdRef.current === responseId) {
          continuationResponseIdRef.current = "";
          continuationTargetLineIdRef.current = "";
          continuationMergeTranscriptRef.current = false;
          continuationDeltaSeenRef.current = false;
        }
        const queued = queuedUserResponseRef.current;
        queuedUserResponseRef.current = null;
        if (queued && !pausedRef.current && !endingRef.current) {
          requestRealtimeResponse(channelRef.current, queued.instructions);
        }
      }
      if (type === "error") {
        connectionErrorCountRef.current += 1;
        const nested = event.error as { message?: string } | undefined;
        const message = nested?.message || "Ошибка голосовой Realtime-сессии.";
        setRealtimeNotice(message);
        reportRealtimeDiagnostic("realtime_error", { message });
      }
    } catch {
      // Диагностические сообщения вне JSON не влияют на голосовую сессию.
    }
  }, [appendDelta, applyOpponentPlaybackEvent, clearIncompleteTurnTimer, clearInterruptionConfirmationTimer, linesRef, negotiationStyle, replaceLine, reportRealtimeDiagnostic, requestOpponentResponse, scheduleResponseRecovery, selectedCase.addressForm, setLines, voiceEvalMode, waitForUserTurnContinuation]);

  useEffect(() => {
    if (!isLive || isPaused || isEnding) return;
    const timer = window.setInterval(() => {
      if (!shouldMonitorRealtimeResponseStall({
        responseInProgress: responseInProgressRef.current,
        opponentSpeaking: opponentSpeakingRef.current,
        userSpeaking: userSpeakingRef.current,
        recoveryPending: recoveryPendingRef.current,
      })) return;
      const silentForMs = Date.now() - lastOpponentDeltaAtRef.current;
      if (silentForMs < 7000) return;
      const responseId = activeResponseIdRef.current;
      reportRealtimeDiagnostic("response_stalled", { responseId, silentForMs, peerState: peerRef.current?.connectionState || "missing" });
      if (channelRef.current?.readyState === "open") channelRef.current.send(JSON.stringify({ type: "response.cancel" }));
      scheduleResponseRecovery("output_stalled", responseId, userTranscriptVersionRef.current, 350);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isEnding, isLive, isPaused, reportRealtimeDiagnostic, scheduleResponseRecovery]);

  function togglePause() {
    if (!isLive) return;
    if (isPaused) {
      resumeTimer();
      return;
    }
    if (pauseUsed) return;

    const pausedAt = Date.now();
    const opponentWasAudible = opponentSpeakingRef.current && opponentSpeechStartedAtRef.current > 0;
    const responseWasActive = responseInProgressRef.current;
    const interruptedOpponent = shouldContinueOpponentAfterPause({
      opponentWasAudible,
      responseInProgress: responseWasActive,
    });
    const assistantItemId = currentAssistantItemIdRef.current;
    const audioEndMs = opponentWasAudible
      ? Math.max(0, pausedAt - opponentSpeechStartedAtRef.current - 150)
      : undefined;
    const targetLine = assistantItemId
      ? linesRef.current.find((line) => line.id === assistantItemId)
      : [...linesRef.current].reverse().find((line) => line.author === "Оппонент");

    if (inputModeRef.current === "duplex" && userSpeechStartedAtRef.current) {
      userSpeakingDurationsMsRef.current.push(Math.max(0, pausedAt - userSpeechStartedAtRef.current));
      userSpeechStartedAtRef.current = 0;
    }
    flushOpponentPlayback(pausedAt);
    clearIncompleteTurnTimer();
    pendingSpeechItemIdsRef.current = new Set();
    pendingUserFragmentsRef.current = [];
    interruptionCandidateRef.current = null;
    clearInterruptionConfirmationTimer();
    queuedUserResponseRef.current = null;
    lastOpponentSpeechEndedAtRef.current = 0;
    if (!pauseTimer()) return;
    lifecycleDispatch({ type: "PAUSE" });
    pausedOpponentRef.current = interruptedOpponent
      ? { lineId: targetLine?.id || "", wasAudible: true, mergeTranscript: responseWasActive }
      : null;
    pauseRealtime(channelRef.current, {
      responseActive: responseWasActive,
      opponentPlaybackActive: opponentWasAudible,
      assistantItemId,
      audioEndMs,
    });
    if (responseWasActive) {
      responseInProgressRef.current = false;
      activeResponseIdRef.current = "";
      interruptedResponseRef.current = null;
    }
    reportRealtimeDiagnostic("pause_started", {
      interruptedOpponent,
      opponentWasAudible,
      responseWasActive,
      audioEndMs: audioEndMs ?? null,
    });
  }

  async function requestHint() {
    if (!isPaused || hintPendingRef.current || hintUsedRef.current || !trainingSessionIdRef.current) return;
    hintPendingRef.current = true;
    setHintStatus("loading");
    setHintError("");
    try {
      const response = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: trainingSessionIdRef.current,
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
    setupStartedAtRef.current = Date.now();
    stopNarration();
    setCaseContentOpen(false);
    setSettingsCollapsed(true);
    lifecycleDispatch({ type: "START" });
    setError("");
    setRealtimeNotice("");
    pausedRef.current = false;
    pushToTalkActiveRef.current = false;
    setPushToTalkActive(false);
    resetTimer();
    endingRef.current = false;
    opponentTurnCountRef.current = 0;
    opponentEmotionRef.current = createInitialOpponentEmotion(negotiationStyle);
    userTurnInterruptedOpponentRef.current = false;
    diagnosticSessionIdRef.current = crypto.randomUUID();
    userSpeakingRef.current = false;
    opponentSpeakingRef.current = false;
    activeResponseIdRef.current = "";
    responseStartedAtRef.current = 0;
    lastOpponentDeltaAtRef.current = 0;
    userTranscriptVersionRef.current = 0;
    pendingUserFragmentsRef.current = [];
    pendingSpeechItemIdsRef.current = new Set();
    clearIncompleteTurnTimer();
    queuedUserResponseRef.current = null;
    interruptedResponseRef.current = null;
    interruptionCandidateRef.current = null;
    bargeInSentAtRef.current = 0;
    clearInterruptionConfirmationTimer();
    recoveryPendingRef.current = false;
    recoveryAttemptsRef.current = 0;
    resetReport();
    setHintStatus("idle");
    setHint(null);
    setHintError("");
    setHintUsed(false);
    hintUsedRef.current = false;
    startedAtRef.current = null;
    trainingSessionIdRef.current = "";
    setupLatencyMsRef.current = 0;
    userSpeechStoppedAtRef.current = 0;
    replyLatenciesMsRef.current = [];
    recoveryCountRef.current = 0;
    interruptionCountRef.current = 0;
    connectionErrorCountRef.current = 0;
    userSpeechStartedAtRef.current = 0;
    opponentSpeechStartedAtRef.current = 0;
    opponentPlaybackTimingRef.current = EMPTY_OUTPUT_AUDIO_BUFFER_TIMING;
    lastOpponentSpeechEndedAtRef.current = 0;
    userSpeakingDurationsMsRef.current = [];
    opponentSpeakingDurationsMsRef.current = [];
    userResponseTimesMsRef.current = [];
    const connectingLines: Line[] = [{ id: "connecting", author: "Система", text: "Устанавливаем защищённую голосовую связь…", time: clockTime() }];
    linesRef.current = connectingLines;
    setLines(connectingLines);

    try {
      const realtimeEndpoint = voiceEvalMode ? "/e2e/voice-eval/realtime" : "/api/realtime/session";
      if (!voiceEvalMode) {
        const privacyResponse = await fetchWithTimeout("/api/account/privacy", { cache: "no-store" }, 10_000);
        const privacy = await privacyResponse.json().catch(() => ({})) as { consent?: boolean; error?: string };
        if (!privacyResponse.ok || !privacy.consent) {
          throw new Error(privacy.error || "Перед запуском подтвердите согласие на сохранение стенограммы в разделе «Личный кабинет → Приватность и данные».");
        }
      }
      const health = await fetchWithTimeout(realtimeEndpoint, { cache: "no-store" }, 10_000);
      if (!health.ok) throw new Error("На сервере не настроен OpenAI API key.");

      const pc = new RTCPeerConnection();
      peerRef.current = pc;
      pc.addEventListener("connectionstatechange", () => {
        if (peerRef.current !== pc || endingRef.current) return;
        reportRealtimeDiagnostic("peer_state", { state: pc.connectionState, iceState: pc.iceConnectionState });
        if (pc.connectionState === "connected") {
          if (disconnectedTimerRef.current) window.clearTimeout(disconnectedTimerRef.current);
          disconnectedTimerRef.current = null;
          if (channelRef.current?.readyState === "open") {
            lifecycleDispatch({ type: "CONNECTED" });
            lifecycleDispatch({ type: "CONNECTION_DEGRADED", degraded: false });
          }
          setRealtimeNotice("");
        } else if (pc.connectionState === "disconnected") {
          if (disconnectedTimerRef.current) window.clearTimeout(disconnectedTimerRef.current);
          disconnectedTimerRef.current = window.setTimeout(() => {
            if (peerRef.current === pc && pc.connectionState === "disconnected" && !endingRef.current) {
              lifecycleDispatch({ type: "CONNECTION_DEGRADED" });
              setRealtimeNotice("Голосовая связь нестабильна. Ожидаем восстановления; при необходимости завершите поединок для анализа.");
            }
          }, 4000);
        } else if (pc.connectionState === "failed") {
          connectionErrorCountRef.current += 1;
          lifecycleDispatch({ type: "CONNECTION_DEGRADED" });
          setRealtimeNotice("Голосовая связь прервалась. Завершите поединок — сохранённые реплики попадут в анализ.");
        }
      });

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => undefined);
        const track = event.track;
        track.addEventListener("mute", () => {
          reportRealtimeDiagnostic("audio_track_muted", { readyState: track.readyState });
          if (opponentSpeakingRef.current) setRealtimeNotice("Аудиопоток оппонента временно пропал — пробуем восстановить ответ…");
        });
        track.addEventListener("unmute", () => {
          reportRealtimeDiagnostic("audio_track_unmuted", { readyState: track.readyState });
          setRealtimeNotice("");
        });
        track.addEventListener("ended", () => {
          flushOpponentPlayback();
          if (endingRef.current) return;
          reportRealtimeDiagnostic("audio_track_ended", { peerState: pc.connectionState });
          lifecycleDispatch({ type: "CONNECTION_DEGRADED" });
          setRealtimeNotice("Аудиоканал оппонента закрылся. Завершите поединок — сохранённые реплики попадут в анализ.");
        });
      };

      const media = await acquireVoiceEvalInputStream(voiceEvalMode);
      streamRef.current = media;
      media.getAudioTracks().forEach((track) => {
        track.enabled = shouldEnableMicrophone(inputModeRef.current, false, pushToTalkActiveRef.current);
      });
      media.getTracks().forEach((track) => pc.addTrack(track, media));

      if (voiceEvalMode) {
        trainingSessionIdRef.current = crypto.randomUUID();
        startedAtRef.current = new Date().toISOString();
      } else {
        const sessionResponse = await fetchWithTimeout("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: selectedCase.id === DEFAULT_CASE.id ? undefined : selectedCase.id,
            caseCode: selectedCase.slug,
            participantRoleIndex: selectedRoleIndex,
            opponentRoleIndex: effectiveOpponentRoleIndex,
            opponentVoice: opponent.voice,
            methodologyId,
          }),
        }, 15_000);
        const sessionPayload = await sessionResponse.json() as { sessionId?: string; startedAt?: string; error?: string };
        if (!sessionResponse.ok || !sessionPayload.sessionId) {
          throw new Error(sessionPayload.error || "Не удалось создать тренировочную сессию.");
        }
        trainingSessionIdRef.current = sessionPayload.sessionId;
        startedAtRef.current = sessionPayload.startedAt || new Date().toISOString();
      }

      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("message", handleEvent);
      channel.addEventListener("open", () => {
        setupLatencyMsRef.current = Math.max(0, Date.now() - setupStartedAtRef.current);
        startTimer();
        lifecycleDispatch({ type: "CONNECTED" });
        reportRealtimeDiagnostic("session_started", { peerState: pc.connectionState, channelState: channel.readyState, inputMode: inputModeRef.current });
        const readyLines: Line[] = [{ id: "ready", author: "Система", text: `Связь установлена. ${opponent.name} начинает переговоры.`, time: clockTime() }];
        linesRef.current = readyLines;
        setLines(readyLines);
        requestRealtimeResponse(
          channel,
          `${FIRST_OPPONENT_TURN_INSTRUCTIONS}\n\n${buildOpponentEmotionInstructions(opponentEmotionRef.current, [], selectedCase.addressForm)}`,
        );
      });
      channel.addEventListener("close", () => {
        if (channelRef.current === channel && !endingRef.current) {
          connectionErrorCountRef.current += 1;
          reportRealtimeDiagnostic("channel_closed", { peerState: pc.connectionState });
          lifecycleDispatch({ type: "CONNECTION_DEGRADED" });
          setRealtimeNotice("Канал событий закрылся. Завершите поединок — сохранённые реплики попадут в анализ.");
        }
      });
      channel.addEventListener("error", () => {
        if (endingRef.current) return;
        connectionErrorCountRef.current += 1;
        reportRealtimeDiagnostic("channel_error", { peerState: pc.connectionState, channelState: channel.readyState });
        lifecycleDispatch({ type: "CONNECTION_DEGRADED" });
        setRealtimeNotice("Ошибка голосового канала. Если связь не восстановится, завершите поединок для анализа.");
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const params = new URLSearchParams({
        negotiationStyle,
        caseId: selectedCase.id,
        caseCode: selectedCase.slug,
        participantRoleIndex: String(selectedRoleIndex),
        opponentRoleIndex: String(effectiveOpponentRoleIndex),
        voice: opponent.voice,
      });
      const response = await fetchWithTimeout(`${realtimeEndpoint}?${params.toString()}`, {
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
      lifecycleDispatch({ type: "RESET" });
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
    lifecycleDispatch({ type: "END" });
    const speechEndedAt = Date.now();
    if (inputModeRef.current === "duplex" && userSpeechStartedAtRef.current) {
      userSpeakingDurationsMsRef.current.push(Math.max(0, speechEndedAt - userSpeechStartedAtRef.current));
      userSpeechStartedAtRef.current = 0;
    }
    flushOpponentPlayback(speechEndedAt);
    const completedDurationSeconds = Math.min(totalDurationSeconds, freezeTimer());
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
    const sessionId = trainingSessionIdRef.current;
    const snapshot = {
      sessionId,
      durationSeconds: completedDurationSeconds,
      turns: completedLines,
      metrics: {
        setupLatencyMs: setupLatencyMsRef.current,
        replyLatenciesMs: replyLatenciesMsRef.current,
        recoveryCount: recoveryCountRef.current,
        interruptionCount: interruptionCountRef.current,
        connectionErrorCount: connectionErrorCountRef.current,
        inputMode: inputModeRef.current,
        opponentTimingSource: opponentPlaybackTimingRef.current.authoritativeEventCount > 0
          ? "output_audio_buffer"
          : "unavailable",
        userSpeakingDurationsMs: userSpeakingDurationsMsRef.current,
        opponentSpeakingDurationsMs: opponentSpeakingDurationsMsRef.current,
        userResponseTimesMs: userResponseTimesMsRef.current,
      },
    };
    closeSession(false);
    if (!sessionId) {
      resetReport();
      setError("Серверная сессия не была создана. Запустите новый поединок.");
      lifecycleDispatch({ type: "COMPLETE" });
      return;
    }
    await persistAndAnalyze(snapshot);
  }

  useEffect(() => {
    endSessionRef.current = endSession;
  });

  const maximumCombinedPanelWidth = useCallback(() => {
    const compact = window.matchMedia("(max-width: 1360px)").matches;
    const shellWidth = compact
      ? 8 + 14 + 58 + (3 * 10) + MIN_COMPACT_CONVERSATION_WIDTH
      : 12 + 24 + 70 + (3 * 14) + MIN_WIDE_CONVERSATION_WIDTH;
    return Math.max(
      MIN_SETTINGS_PANEL_WIDTH + MIN_OPPONENT_PANEL_WIDTH,
      window.innerWidth - shellWidth,
    );
  }, []);

  const applyPanelWidths = useCallback((widths: PanelWidths) => {
    const fittedWidths = fitPanelWidths(widths, maximumCombinedPanelWidth());
    setPanelWidths(fittedWidths);
  }, [maximumCombinedPanelWidth]);

  useEffect(() => {
    if (!panelWidths) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(PANEL_WIDTHS_STORAGE_KEY, JSON.stringify(panelWidths));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [panelWidths]);

  useEffect(() => {
    const storedWidths = window.localStorage.getItem(PANEL_WIDTHS_STORAGE_KEY);
    if (!storedWidths) return;

    try {
      const parsedWidths = JSON.parse(storedWidths) as Partial<PanelWidths>;
      if (!Number.isFinite(parsedWidths.settings) || !Number.isFinite(parsedWidths.opponent)) return;
      const timer = window.setTimeout(() => {
        setPanelWidths(fitPanelWidths(
          { settings: Number(parsedWidths.settings), opponent: Number(parsedWidths.opponent) },
          maximumCombinedPanelWidth(),
        ));
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      window.localStorage.removeItem(PANEL_WIDTHS_STORAGE_KEY);
    }
  }, [maximumCombinedPanelWidth]);

  useEffect(() => {
    const fitSavedWidths = () => {
      if (window.innerWidth < MIN_RESIZABLE_VIEWPORT_WIDTH) return;
      setPanelWidths((currentWidths) => currentWidths
        ? fitPanelWidths(currentWidths, maximumCombinedPanelWidth())
        : currentWidths);
    };
    window.addEventListener("resize", fitSavedWidths);
    return () => window.removeEventListener("resize", fitSavedWidths);
  }, [maximumCombinedPanelWidth]);

  useEffect(() => {
    document.body.classList.toggle("is-resizing-panels", resizingPanel !== null);
    return () => document.body.classList.remove("is-resizing-panels");
  }, [resizingPanel]);

  const renderedPanelWidths = useCallback((): PanelWidths | null => {
    const settingsWidth = settingsPanelRef.current?.getBoundingClientRect().width;
    const opponentWidth = opponentPanelRef.current?.getBoundingClientRect().width;
    if (!settingsWidth || !opponentWidth) return null;

    return {
      settings: isSettingsCollapsed
        ? (panelWidths?.settings ?? (window.innerWidth <= 1360 ? 310 : 355))
        : settingsWidth,
      opponent: opponentWidth,
    };
  }, [isSettingsCollapsed, panelWidths]);

  const resizeFromRenderedLayout = useCallback((panel: ResizablePanel, deltaX: number) => {
    const widths = renderedPanelWidths();
    const conversationWidth = conversationPanelRef.current?.getBoundingClientRect().width;
    if (!widths || !conversationWidth) return;

    applyPanelWidths(resizePanels({
      panel,
      widths,
      conversationWidth,
      deltaX,
      minimumConversationWidth: window.innerWidth <= 1360
        ? MIN_COMPACT_CONVERSATION_WIDTH
        : MIN_WIDE_CONVERSATION_WIDTH,
    }));
  }, [applyPanelWidths, renderedPanelWidths]);

  const startPanelResize = useCallback((panel: ResizablePanel, event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < MIN_RESIZABLE_VIEWPORT_WIDTH || (panel === "settings" && isSettingsCollapsed)) return;
    const widths = renderedPanelWidths();
    const conversationWidth = conversationPanelRef.current?.getBoundingClientRect().width;
    if (!widths || !conversationWidth) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    panelDragRef.current = { panel, startX: event.clientX, widths, conversationWidth };
    setResizingPanel(panel);
  }, [isSettingsCollapsed, renderedPanelWidths]);

  const continuePanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panelDragRef.current;
    if (!drag) return;

    applyPanelWidths(resizePanels({
      panel: drag.panel,
      widths: drag.widths,
      conversationWidth: drag.conversationWidth,
      deltaX: event.clientX - drag.startX,
      minimumConversationWidth: window.innerWidth <= 1360
        ? MIN_COMPACT_CONVERSATION_WIDTH
        : MIN_WIDE_CONVERSATION_WIDTH,
    }));
  }, [applyPanelWidths]);

  const finishPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panelDragRef.current = null;
    setResizingPanel(null);
  }, []);

  const resizePanelWithKeyboard = useCallback((panel: ResizablePanel, event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.shiftKey ? 48 : 16;
    resizeFromRenderedLayout(panel, event.key === "ArrowLeft" ? -step : step);
  }, [resizeFromRenderedLayout]);

  const resetPanelWidths = useCallback(() => {
    panelDragRef.current = null;
    setResizingPanel(null);
    setPanelWidths(null);
    window.localStorage.removeItem(PANEL_WIDTHS_STORAGE_KEY);
  }, []);

  const panelWidthStyle = panelWidths ? {
    "--settings-panel-width": `${panelWidths.settings}px`,
    "--opponent-panel-width": `${panelWidths.opponent}px`,
  } as CSSProperties : undefined;

  return (
    <main
      className={`duel-app ${isDuelMode ? "duel-mode" : ""} ${isSettingsCollapsed ? "settings-collapsed" : ""} ${panelWidths ? "panels-resized" : ""}`}
      style={panelWidthStyle}
    >
      <AppNavRail isAdministrator={isAdministrator} />
      {caseAddedNotice && <CaseAddedNotice onDismiss={() => setCaseAddedNotice(false)} />}

      <aside ref={settingsPanelRef} className={`settings-panel neon-panel ${isSettingsCollapsed ? "is-collapsed" : ""}`}>
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
          <div className="setting-label">ВЫБЕРИ СТИЛЬ ОППОНЕНТА</div>
          <div className="style-options" role="group" aria-label="Стиль переговоров">
            <button className={negotiationStyle === "collaborative" ? "selected" : ""} onClick={() => setNegotiationStyle("collaborative")} disabled={isLive || isBusy} aria-pressed={negotiationStyle === "collaborative"}>Сотрудничество</button>
            <button className={negotiationStyle === "hard" ? "selected" : ""} onClick={() => setNegotiationStyle("hard")} disabled={isLive || isBusy} aria-pressed={negotiationStyle === "hard"}>Жёсткий</button>
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-label">УСТАНОВИ ДЛИТЕЛЬНОСТЬ</div>
          <div className="timer-options" role="group" aria-label="Длительность переговоров">
            {DURATION_OPTIONS.map((minutes) => <button key={minutes} className={durationMinutes === minutes ? "selected" : ""} onClick={() => setDurationMinutes(minutes)} disabled={isLive || isBusy} aria-pressed={durationMinutes === minutes}>{minutes} мин</button>)}
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-label">ВЫБЕРИ РЕЖИМ МИКРОФОНА</div>
          <div className="input-mode-options" role="group" aria-label="Режим микрофона">
            <div className={inputMode === "duplex" ? "input-mode-option selected" : "input-mode-option"}>
              <button type="button" onClick={() => chooseInputMode("duplex")} disabled={isLive || isBusy} aria-pressed={inputMode === "duplex"}>Дуплекс</button>
              <span className="mode-info" tabIndex={0} aria-label="Описание режима Дуплекс">i<span role="tooltip">Микрофон работает постоянно: можно говорить одновременно с оппонентом и перебивать его.</span></span>
            </div>
            <div className={inputMode === "push_to_talk" ? "input-mode-option selected" : "input-mode-option"}>
              <button type="button" onClick={() => chooseInputMode("push_to_talk")} disabled={isLive || isBusy} aria-pressed={inputMode === "push_to_talk"}>Обычный</button>
              <span className="mode-info" tabIndex={0} aria-label="Описание обычного режима">i<span role="tooltip">Микрофон передаёт звук только пока вы удерживаете кнопку. Подходит для шумных помещений и турниров с комментариями ведущего.</span></span>
            </div>
          </div>
          <p className="speech-analytics-availability">
            Речевая аналитика темпа, пауз, доли говорения и реакции на давление формируется только в режиме «Дуплекс».
          </p>
        </section>

        <section className="setting-group methodology-setting">
          <label className="setting-label" htmlFor="negotiation-methodology">МЕТОДОЛОГИЯ ПЕРЕГОВОРОВ</label>
          <select id="negotiation-methodology" value={methodologyId} onChange={(event) => setMethodologyId(event.target.value as MethodologyId)} disabled={isLive || isBusy || isEnding || analysisStatus === "loading"}>
            {methodologyOptions().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </section>
        </>)}
      </aside>

      <div
        className="panel-resize-handle settings-resize-handle"
        role="separator"
        aria-label="Изменить ширину панели настроек"
        aria-orientation="vertical"
        aria-valuemin={MIN_SETTINGS_PANEL_WIDTH}
        aria-valuenow={Math.round(panelWidths?.settings ?? 355)}
        tabIndex={isSettingsCollapsed ? -1 : 0}
        title="Перетащите мышью. Двойной щелчок сбрасывает ширину"
        onPointerDown={(event) => startPanelResize("settings", event)}
        onPointerMove={continuePanelResize}
        onPointerUp={finishPanelResize}
        onPointerCancel={finishPanelResize}
        onKeyDown={(event) => resizePanelWithKeyboard("settings", event)}
        onDoubleClick={resetPanelWidths}
      ><span /></div>

      <section ref={conversationPanelRef} className="conversation-panel neon-panel" aria-label="Переговоры">
        <header className="conversation-header">
          <div>
            <h1><span className="equalizer-icon">▥</span> ПЕРЕГОВОРЫ</h1>
            <p>Общайтесь с виртуальным оппонентом. Реплики появляются здесь в реальном времени.</p>
          </div>
          <div className="live-status">
            <span className={isLive && !isPaused ? "status-dot live" : "status-dot"} />
            <span>{isBusy ? "ПОДКЛЮЧЕНИЕ" : isEnding ? "ЗАВЕРШЕНИЕ" : lifecycleState.connectionDegraded ? "СБОЙ СВЯЗИ" : isPaused ? "ПАУЗА" : isLive ? "В ЭФИРЕ" : "ГОТОВ"}</span>
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
            <div className="listening-copy"><span className={userSpeaking ? "mini-wave active" : "mini-wave"}>▥</span><small>{isEnding ? "Запускаем анализ…" : isPaused ? `Пауза ${formatTime(pauseRemaining)}` : userSpeaking ? "Вы говорите…" : opponentSpeaking ? "Оппонент отвечает…" : inputMode === "push_to_talk" && isLive && !pushToTalkActive ? "Микрофон выключен" : isLive ? "Слушаю…" : "Ожидание"}</small></div>
            <div className="waveform" aria-hidden="true">
              {WAVE_BARS.map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * -55}ms` }} />)}
            </div>
            {inputMode === "push_to_talk" ? (
              <button
                type="button"
                className={`mic-orb push-to-talk ${pushToTalkActive ? "capturing" : ""} ${userSpeaking ? "speaking" : ""}`}
                disabled={!isLive || isPaused || isEnding}
                aria-label={pushToTalkActive ? "Отпустите, чтобы выключить микрофон" : "Удерживайте, чтобы говорить"}
                aria-pressed={pushToTalkActive}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); beginPushToTalk(); }}
                onPointerUp={() => setPushToTalkCapture(false)}
                onPointerCancel={() => setPushToTalkCapture(false)}
                onLostPointerCapture={() => setPushToTalkCapture(false)}
                onKeyDown={(event) => { if (!event.repeat && (event.key === " " || event.key === "Enter")) { event.preventDefault(); beginPushToTalk(); } }}
                onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); setPushToTalkCapture(false); } }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>
              </button>
            ) : <div className={`mic-orb ${userSpeaking ? "speaking" : ""}`}>◉</div>}
          </div>
          <p className="speech-note">{isPaused ? "ⓘ Микрофон и оппонент на паузе. Нажмите кнопку с таймером, чтобы продолжить." : inputMode === "push_to_talk" ? "ⓘ Удерживайте кнопку микрофона, пока говорите. Отпустите её, чтобы система перестала обрабатывать окружающие звуки." : "ⓘ Говорите естественно. Система распознает речь и отобразит её в диалоге."}</p>
          {realtimeNotice && <p className="realtime-notice" role="status">ⓘ {realtimeNotice}</p>}
        </div>

        {error && <div className="error-banner" role="alert"><strong>Не удалось начать переговоры.</strong><span>{error}</span></div>}

        <footer className="session-actions">
          <button className={`start-session ${isBusy ? "is-connecting" : ""}`} onClick={startSession} disabled={isLive || isBusy || isEnding || analysisStatus === "loading"}>
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
            <div className="analysis-loading"><span className="analysis-spinner" /><div><strong>АНАЛИЗИРУЕМ ПОЕДИНОК</strong><p>Сопоставляем стенограмму с методологией «{getMethodology(analysisMethodologyId).shortName}»…</p></div></div>
            )}
            {analysisStatus === "error" && (
              <div className="analysis-error">
                <strong>Анализ пока недоступен</strong>
                <p>{analysisError}</p>
                {analysisSessionId && canRetryAnalysis && (
                  <button type="button" onClick={() => void retryAnalysis()}>ПОВТОРИТЬ АНАЛИЗ</button>
                )}
              </div>
            )}
            {analysisStatus === "ready" && analysis && (
              <NegotiationReport analysis={analysis} methodologyId={analysisMethodologyId} opponentName={opponent.name} speechAnalytics={speechAnalytics} sessionId={analysisSessionId} onReanalyzed={applyReanalysis} />
            )}
          </section>
        )}

      </section>

      <div
        className="panel-resize-handle opponent-resize-handle"
        role="separator"
        aria-label="Изменить ширину панелей переговоров и описания кейса"
        aria-orientation="vertical"
        aria-valuemin={MIN_OPPONENT_PANEL_WIDTH}
        aria-valuenow={Math.round(panelWidths?.opponent ?? 395)}
        tabIndex={0}
        title="Перетащите влево, чтобы расширить кейс. Двойной щелчок сбрасывает ширину"
        onPointerDown={(event) => startPanelResize("opponent", event)}
        onPointerMove={continuePanelResize}
        onPointerUp={finishPanelResize}
        onPointerCancel={finishPanelResize}
        onKeyDown={(event) => resizePanelWithKeyboard("opponent", event)}
        onDoubleClick={resetPanelWidths}
      ><span /></div>

      <aside ref={opponentPanelRef} className="opponent-panel neon-panel">
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
          <p className="opponent-style">{opponent.style}</p>
          {allowedOpponentIndices.length > 1 && <div className="opponent-switcher" role="group" aria-label="Выбор допустимого оппонента"><button type="button" onClick={() => chooseAdjacentOpponent(-1)} disabled={isLive || isBusy || isEnding} aria-label="Предыдущий допустимый оппонент">‹</button><span>{allowedOpponentIndices.indexOf(effectiveOpponentRoleIndex) + 1} / {allowedOpponentIndices.length}</span><button type="button" onClick={() => chooseAdjacentOpponent(1)} disabled={isLive || isBusy || isEnding} aria-label="Следующий допустимый оппонент">›</button></div>}
        </section>

        <h2 className="case-title">ОПИСАНИЕ КЕЙСА</h2>
        <section className="case-description">
          <CaseBlock icon="◇" title="КРАТКОЕ ОПИСАНИЕ">{selectedCase.summary}</CaseBlock>
          <CaseBlock icon="▤" title="КОНТЕКСТ">{selectedCase.situation}</CaseBlock>
          <CaseBlock icon="⚔" title="КОНФЛИКТ">{selectedCase.conflict}</CaseBlock>
          <CaseBlock icon="◉" title="ОБРАЩЕНИЕ">{selectedCase.addressForm === "informal" ? "Участники общаются на «ты»." : "Участники общаются на «вы»."}</CaseBlock>
          {allRoles.map((role, index) => <RoleCaseBlock key={role.name} title={`РОЛЬ ${index + 1}`} role={role} selected={selectedRoleIndex === index} />)}
          <CaseNegotiationPairs roles={allRoles} pairs={selectedCase.negotiationPairs} />
        </section>
      </aside>

      {quickUploadOpen && (
        <div className="case-upload-modal" role="dialog" aria-modal="true" aria-labelledby="quick-case-title">
          <button className="case-modal-backdrop" aria-label="Закрыть" onClick={() => quickStatus !== "loading" && setQuickUploadOpen(false)} />
          <section>
            <header><div><span>БЫСТРОЕ ДОБАВЛЕНИЕ</span><h2 id="quick-case-title">Загрузить кейс</h2></div><button onClick={() => setQuickUploadOpen(false)} disabled={quickStatus === "loading"} aria-label="Закрыть">×</button></header>
            <p>Выберите один файл. Система сохранит оригинал, извлечёт факты, приведёт ситуацию и роли к каноническому виду и добавит готовый кейс в список. Изображения и озвучка появятся не сразу — их фоновая генерация занимает дополнительное время.</p>
            <label className="quick-file-drop"><input ref={quickFileInputRef} type="file" accept=".txt,.md,.csv,.json,.xml,.html,.htm,.rtf,.pdf,.docx" disabled={quickStatus === "loading"} onChange={(event) => chooseQuickFile(event.target.files?.[0] || null)} /><strong>{quickFile ? quickFile.name : "ВЫБРАТЬ ФАЙЛ"}</strong><small>TXT, MD, CSV, JSON, XML, HTML, RTF, PDF или DOCX · до 3 МБ</small></label>
            <CaseVisibilityPicker value={quickVisibility} onChange={setQuickVisibility} disabled={quickStatus === "loading"} compact />
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
              <CaseBlock icon="◉" title="ОБРАЩЕНИЕ">{selectedCase.addressForm === "informal" ? "Участники общаются на «ты»." : "Участники общаются на «вы»."}</CaseBlock>
              <div className="case-content-roles">
                {allRoles.map((role, index) => <RoleCaseBlock key={role.name} title={`РОЛЬ ${index + 1}`} role={role} selected={selectedRoleIndex === index} />)}
              </div>
              <CaseNegotiationPairs roles={allRoles} pairs={selectedCase.negotiationPairs} />
              {selectedCase.stakes.length > 0 && <CaseBlock icon="◆" title="СТАВКИ"><ul>{selectedCase.stakes.map((item) => <li key={item}>{item}</li>)}</ul></CaseBlock>}
              <CaseBlock icon="▶" title="НАЧАЛЬНАЯ СИТУАЦИЯ">{selectedCase.startSituation}</CaseBlock>
            </div>}
            {(narrationError || comicError) && <p className="narration-error">{narrationError || comicError}</p>}
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
      <span className="setting-label">ВЫБЕРИ КЕЙС</span>
      <span className="case-select-shell"><b>▣</b><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{cases.map((item) => <option value={item.id} key={item.id}>{item.title}{item.visibility === "private" ? " · приватный" : ""}</option>)}</select><i>⌄</i></span>
    </label>
  );
}

function RoleSelect({ selectedCase, value, onChange, disabled }: { selectedCase: CanonicalCase; value: number; onChange: (value: number) => void; disabled: boolean }) {
  const roles = [selectedCase.userRole, selectedCase.opponentRole, ...(selectedCase.additionalRoles || [])];
  return (
    <label className="setting-group case-select-control">
      <span className="setting-label">ВЫБЕРИ РОЛЬ</span>
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
