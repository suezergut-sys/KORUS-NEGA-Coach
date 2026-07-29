"use client";

import { useReducer } from "react";
import {
  initialNegotiationState,
  isNegotiationActive,
  isNegotiationBusy,
  negotiationMachineReducer,
} from "@/lib/negotiation-machine";

export function useNegotiationMachine() {
  const [state, dispatch] = useReducer(negotiationMachineReducer, initialNegotiationState);
  return {
    state,
    dispatch,
    isActive: isNegotiationActive(state.phase),
    isBusy: isNegotiationBusy(state.phase),
    isPaused: state.phase === "paused",
    isEnding: state.phase === "ending" || state.phase === "analyzing",
  };
}
