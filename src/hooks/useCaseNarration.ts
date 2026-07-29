"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComicPanel } from "@/lib/case-comic";

type NarrationStatus = "idle" | "loading" | "playing" | "error";
type VoiceMode = "female" | "male";

function panelAudio(panel: ComicPanel, voiceMode: VoiceMode) {
  return typeof panel.audio === "string" ? panel.audio : panel.audio[voiceMode];
}

export function useCaseNarration(options: {
  caseId: string;
  participantRoleIndex: number;
  opponentRoleIndex: number;
  opponentVoice: string;
  voiceMode: VoiceMode;
  panels: ComicPanel[];
  panelIndex: number;
  setPanelIndex: (value: number | ((current: number) => number)) => void;
  modalOpen: boolean;
}) {
  const {
    caseId,
    participantRoleIndex,
    opponentRoleIndex,
    opponentVoice,
    voiceMode,
    panels,
    panelIndex,
    setPanelIndex,
    modalOpen,
  } = options;
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playRef = useRef<(index?: number) => Promise<void>>(async () => undefined);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!modalOpen || !panels.length) return;
    panels.forEach((panel) => {
      const source = panelAudio(panel, voiceMode);
      if (cacheRef.current.has(source)) return;
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = source;
      audio.load();
      cacheRef.current.set(source, audio);
    });
  }, [modalOpen, panels, voiceMode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingRef.current = false;
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setStatus("idle");
  }, []);

  const play = useCallback(async (requestedPanelIndex?: number) => {
    if (pendingRef.current) return;
    if (status === "loading" || status === "playing") {
      stop();
      return;
    }
    pendingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError("");
    try {
      const preparedIndex = typeof requestedPanelIndex === "number" ? requestedPanelIndex : -1;
      const preparedPanel = preparedIndex >= 0 ? panels[preparedIndex] : undefined;
      if (preparedPanel) {
        const source = panelAudio(preparedPanel, voiceMode);
        const audio = cacheRef.current.get(source) || new Audio(source);
        audio.currentTime = 0;
        audioRef.current = audio;
        audio.onended = () => {
          stop();
          if (preparedIndex < panels.length - 1) {
            const next = preparedIndex + 1;
            setPanelIndex(next);
            window.setTimeout(() => void playRef.current(next), 50);
          }
        };
        audio.onerror = () => {
          stop();
          setStatus("error");
          setError("Не удалось воспроизвести подготовленное аудио.");
        };
        await audio.play();
        setStatus("playing");
        return;
      }
      const response = await fetch("/api/cases/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          participantRoleIndex,
          opponentRoleIndex,
          voice: opponentVoice,
          panelIndex: requestedPanelIndex,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Не удалось озвучить кейс.");
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      urlRef.current = url;
      audioRef.current = audio;
      audio.onended = () => {
        stop();
        if (typeof requestedPanelIndex === "number" && requestedPanelIndex < panels.length - 1) {
          const next = requestedPanelIndex + 1;
          setPanelIndex(next);
          window.setTimeout(() => void playRef.current(next), 250);
        }
      };
      audio.onerror = () => {
        stop();
        setStatus("error");
        setError("Не удалось воспроизвести аудио.");
      };
      await audio.play();
      setStatus("playing");
    } catch (caught) {
      if (controller.signal.aborted) return;
      stop();
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось озвучить кейс.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      pendingRef.current = false;
    }
  }, [caseId, opponentRoleIndex, opponentVoice, panels, participantRoleIndex, setPanelIndex, status, stop, voiceMode]);

  useEffect(() => {
    playRef.current = play;
  }, [play]);
  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (status === "loading" || status === "playing") return stop();
    return play(panels.length ? panelIndex : undefined);
  }, [panelIndex, panels.length, play, status, stop]);

  return { status, error, stop, play, toggle };
}
