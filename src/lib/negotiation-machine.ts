export type NegotiationPhase =
  | "idle"
  | "connecting"
  | "live"
  | "paused"
  | "ending"
  | "analyzing"
  | "complete";

export type NegotiationMachineState = {
  phase: NegotiationPhase;
  connectionDegraded: boolean;
};

export type NegotiationMachineEvent =
  | { type: "START" }
  | { type: "CONNECTED" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CONNECTION_DEGRADED"; degraded?: boolean }
  | { type: "END" }
  | { type: "ANALYZE" }
  | { type: "COMPLETE" }
  | { type: "RESET" };

export const initialNegotiationState: NegotiationMachineState = {
  phase: "idle",
  connectionDegraded: false,
};

const transitions: Record<NegotiationPhase, Partial<Record<NegotiationMachineEvent["type"], NegotiationPhase>>> = {
  idle: { START: "connecting", RESET: "idle" },
  connecting: { CONNECTED: "live", END: "ending", RESET: "idle" },
  live: { PAUSE: "paused", END: "ending", RESET: "idle" },
  paused: { RESUME: "live", END: "ending", RESET: "idle" },
  ending: { ANALYZE: "analyzing", COMPLETE: "complete", RESET: "idle" },
  analyzing: { COMPLETE: "complete", RESET: "idle" },
  complete: { START: "connecting", ANALYZE: "analyzing", RESET: "idle" },
};

export function negotiationMachineReducer(
  state: NegotiationMachineState,
  event: NegotiationMachineEvent,
): NegotiationMachineState {
  if (event.type === "CONNECTION_DEGRADED") {
    if (state.phase !== "live" && state.phase !== "paused") return state;
    return { ...state, connectionDegraded: event.degraded ?? true };
  }
  const nextPhase = transitions[state.phase][event.type];
  if (!nextPhase) return state;
  return {
    phase: nextPhase,
    connectionDegraded: nextPhase === "live" || nextPhase === "paused"
      ? state.connectionDegraded
      : false,
  };
}

export function isNegotiationActive(phase: NegotiationPhase) {
  return phase === "live" || phase === "paused";
}

export function isNegotiationBusy(phase: NegotiationPhase) {
  return phase === "connecting" || phase === "ending" || phase === "analyzing";
}
