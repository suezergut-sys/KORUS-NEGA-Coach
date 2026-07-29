"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useNegotiationTimer(options: {
  active: boolean;
  paused: boolean;
  ending: boolean;
  totalSeconds: number;
  onExpire: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const { active, paused, ending, totalSeconds, onExpire, onPause, onResume } = options;
  const [seconds, setSeconds] = useState(0);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseUsed, setPauseUsed] = useState(false);
  const elapsedActiveMsRef = useRef(0);
  const activeRunStartedAtRef = useRef<number | null>(null);
  const pauseEndsAtRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const currentActiveSeconds = useCallback(() => {
    const runningMs = activeRunStartedAtRef.current === null
      ? 0
      : Date.now() - activeRunStartedAtRef.current;
    return Math.max(0, Math.floor((elapsedActiveMsRef.current + runningMs) / 1000));
  }, []);

  const freeze = useCallback(() => {
    if (activeRunStartedAtRef.current !== null) {
      elapsedActiveMsRef.current += Date.now() - activeRunStartedAtRef.current;
      activeRunStartedAtRef.current = null;
    }
    const elapsed = currentActiveSeconds();
    setSeconds(elapsed);
    return elapsed;
  }, [currentActiveSeconds]);

  const start = useCallback(() => {
    elapsedActiveMsRef.current = 0;
    activeRunStartedAtRef.current = Date.now();
    pauseEndsAtRef.current = null;
    setSeconds(0);
    setPauseRemaining(0);
    setPauseUsed(false);
  }, []);

  const reset = useCallback(() => {
    elapsedActiveMsRef.current = 0;
    activeRunStartedAtRef.current = null;
    pauseEndsAtRef.current = null;
    setSeconds(0);
    setPauseRemaining(0);
    setPauseUsed(false);
  }, []);

  const pause = useCallback(() => {
    if (!active || paused || pauseUsed) return false;
    freeze();
    pauseEndsAtRef.current = Date.now() + 60_000;
    setPauseRemaining(60);
    setPauseUsed(true);
    onPause();
    return true;
  }, [active, freeze, onPause, pauseUsed, paused]);

  const resume = useCallback(() => {
    if (!paused) return;
    pauseEndsAtRef.current = null;
    if (activeRunStartedAtRef.current === null) activeRunStartedAtRef.current = Date.now();
    setPauseRemaining(0);
    onResume();
  }, [onResume, paused]);

  useEffect(() => {
    if (!active || paused || ending) return;
    const tick = () => setSeconds(Math.min(totalSeconds, currentActiveSeconds()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [active, currentActiveSeconds, ending, paused, totalSeconds]);

  useEffect(() => {
    if (!active || paused || ending || totalSeconds - seconds > 0) return;
    const timeout = window.setTimeout(() => onExpireRef.current(), 0);
    return () => window.clearTimeout(timeout);
  }, [active, ending, paused, seconds, totalSeconds]);

  useEffect(() => {
    if (!active || !paused || pauseRemaining <= 0) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(((pauseEndsAtRef.current || Date.now()) - Date.now()) / 1000),
      );
      if (remaining <= 0) resume();
      else setPauseRemaining(remaining);
    }, 250);
    return () => window.clearInterval(interval);
  }, [active, pauseRemaining, paused, resume]);

  return {
    seconds,
    pauseRemaining,
    pauseUsed,
    remainingSeconds: Math.max(0, totalSeconds - seconds),
    start,
    reset,
    pause,
    resume,
    freeze,
    currentActiveSeconds,
  };
}
