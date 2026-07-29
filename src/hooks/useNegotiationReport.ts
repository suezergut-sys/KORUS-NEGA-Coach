"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NegotiationAnalysis } from "@/lib/analysis-types";
import type { TranscriptLine } from "@/hooks/useNegotiationTranscript";
import { hasEnoughUserTurnsForAnalysis, INSUFFICIENT_ANALYSIS_MESSAGE } from "@/lib/transcript";
import { readJsonResponse } from "@/lib/http-response";
import type { MethodologyId } from "@/lib/methodologies";

export type CompletedNegotiation = {
  sessionId: string;
  durationSeconds: number;
  turns: TranscriptLine[];
  metrics: Record<string, unknown>;
};

export function useNegotiationReport(options: {
  methodologyId: MethodologyId;
  onAnalyze: () => void;
  onComplete: () => void;
}) {
  const { methodologyId, onAnalyze, onComplete } = options;
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [analysis, setAnalysis] = useState<NegotiationAnalysis | null>(null);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [analysisMethodologyId, setAnalysisMethodologyId] = useState<MethodologyId>(methodologyId);
  const completedRef = useRef<CompletedNegotiation | null>(null);
  const analysisRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (status === "ready") analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [status]);

  const reset = useCallback(() => {
    completedRef.current = null;
    setStatus("idle");
    setAnalysis(null);
    setError("");
    setSessionId("");
    setCanRetry(false);
  }, []);

  const analyze = useCallback(async (snapshot: CompletedNegotiation) => {
    completedRef.current = snapshot;
    onAnalyze();
    setStatus("loading");
    setAnalysisMethodologyId(methodologyId);
    setSessionId(snapshot.sessionId);
    setCanRetry(hasEnoughUserTurnsForAnalysis(snapshot.turns));
    setError("");
    try {
      const finalizeResponse = await fetch(`/api/sessions/${snapshot.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds: snapshot.durationSeconds,
          turns: snapshot.turns,
          metrics: snapshot.metrics,
        }),
      });
      const finalizeResult = await readJsonResponse<{ error?: string }>(finalizeResponse);
      if (!finalizeResult.isJson || !finalizeResponse.ok) {
        throw new Error(finalizeResult.payload?.error || "Не удалось сохранить стенограмму. Попробуйте ещё раз.");
      }
      if (!hasEnoughUserTurnsForAnalysis(snapshot.turns)) {
        setStatus("error");
        setCanRetry(false);
        setError(`${INSUFFICIENT_ANALYSIS_MESSAGE} Стенограмма и технические метрики сохранены.`);
        return;
      }
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: snapshot.sessionId }),
      });
      const result = await readJsonResponse<{
        analysis?: NegotiationAnalysis;
        error?: string;
      }>(response);
      if (!result.isJson) {
        throw new Error("Сервис анализа временно недоступен. Стенограмма сохранена — попробуйте ещё раз.");
      }
      if (!response.ok || !result.payload?.analysis) {
        throw new Error(result.payload?.error || "Не удалось получить оценку. Стенограмма сохранена.");
      }
      setAnalysis(result.payload.analysis);
      setStatus("ready");
      setCanRetry(false);
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось выполнить анализ. Стенограмма сохранена.");
    } finally {
      onComplete();
    }
  }, [methodologyId, onAnalyze, onComplete]);

  const retry = useCallback(async () => {
    if (!completedRef.current || status === "loading") return;
    await analyze(completedRef.current);
  }, [analyze, status]);

  return {
    status,
    analysis,
    error,
    sessionId,
    canRetry,
    analysisMethodologyId,
    analysisRef,
    completedRef,
    analyze,
    retry,
    reset,
  };
}
