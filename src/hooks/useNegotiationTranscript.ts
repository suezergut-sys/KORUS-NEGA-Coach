"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TranscriptSpeaker = "Вы" | "Оппонент" | "Система";
export type TranscriptLine = {
  id: string;
  author: TranscriptSpeaker;
  text: string;
  time: string;
};

function clockTime() {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

export function useNegotiationTranscript() {
  const [lines, setLinesState] = useState<TranscriptLine[]>([]);
  const linesRef = useRef<TranscriptLine[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const setLines = useCallback((next: TranscriptLine[] | ((current: TranscriptLine[]) => TranscriptLine[])) => {
    setLinesState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      linesRef.current = value;
      return value;
    });
  }, []);

  const replaceLine = useCallback((author: TranscriptSpeaker, text: string, id: string) => {
    if (!text.trim()) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      const line = { id, author, text: text.trim(), time: clockTime() };
      if (existing === -1) return [...current, line];
      const next = [...current];
      next[existing] = { ...next[existing], text: text.trim() };
      return next;
    });
  }, [setLines]);

  const appendDelta = useCallback((author: TranscriptSpeaker, delta: string, id: string) => {
    if (!delta) return;
    setLines((current) => {
      const existing = current.findIndex((line) => line.id === id);
      if (existing === -1) return [...current, { id, author, text: delta, time: clockTime() }];
      const next = [...current];
      next[existing] = { ...next[existing], text: `${next[existing].text}${delta}` };
      return next;
    });
  }, [setLines]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  return {
    lines,
    linesRef,
    transcriptEndRef,
    setLines,
    replaceLine,
    appendDelta,
    clockTime,
  };
}
