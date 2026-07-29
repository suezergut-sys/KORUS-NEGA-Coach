"use client";

import { useReducer, useState } from "react";
import { initialNegotiationState, negotiationMachineReducer } from "@/lib/negotiation-machine";

export default function P2E2EHarness() {
  const [machine, dispatch] = useReducer(negotiationMachineReducer, initialNegotiationState);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  function start() {
    dispatch({ type: "START" });
    window.setTimeout(() => dispatch({ type: "CONNECTED" }), 20);
  }

  function finish() {
    dispatch({ type: "END" });
    window.setTimeout(() => {
      dispatch({ type: "ANALYZE" });
      window.setTimeout(() => {
        setAnalysisFailed(true);
        dispatch({ type: "COMPLETE" });
      }, 20);
    }, 20);
  }

  function retry() {
    setAnalysisFailed(false);
    dispatch({ type: "ANALYZE" });
    window.setTimeout(() => {
      setAnalysisReady(true);
      dispatch({ type: "COMPLETE" });
    }, 20);
  }

  return (
    <main>
      <h1>P2 E2E lifecycle</h1>
      <output data-testid="phase">{machine.phase}</output>
      <output data-testid="connection">{machine.connectionDegraded ? "degraded" : "stable"}</output>
      <button data-testid="start" onClick={start}>Запустить</button>
      <button data-testid="pause" onClick={() => dispatch({ type: "PAUSE" })}>Пауза</button>
      <button data-testid="resume" onClick={() => dispatch({ type: "RESUME" })}>Продолжить</button>
      <button data-testid="disconnect" onClick={() => dispatch({ type: "CONNECTION_DEGRADED" })}>Обрыв</button>
      <button data-testid="end" onClick={finish}>Завершить</button>
      {analysisFailed && <button data-testid="retry" onClick={retry}>Повторить анализ</button>}
      {analysisReady && <output data-testid="analysis">ready</output>}
      <section>
        <output data-testid="private-case">{isOwner ? "Секретное сокращение штата" : "Приватный кейс пользователя"}</output>
        <button data-testid="toggle-owner" onClick={() => setIsOwner((value) => !value)}>Сменить пользователя</button>
      </section>
    </main>
  );
}
