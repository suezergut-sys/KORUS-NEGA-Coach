export type OutputAudioBufferTimingState = {
  startedAt: number;
  responseId: string;
  authoritativeEventCount: number;
};

export type OutputAudioBufferTimingResult = {
  state: OutputAudioBufferTimingState;
  durationMs: number | null;
  completedAt: number | null;
  started: boolean;
  stopped: boolean;
};

export const EMPTY_OUTPUT_AUDIO_BUFFER_TIMING: OutputAudioBufferTimingState = {
  startedAt: 0,
  responseId: "",
  authoritativeEventCount: 0,
};

function timestamp(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function applyOutputAudioBufferEvent(
  current: OutputAudioBufferTimingState,
  event: {
    type: "started" | "stopped" | "cleared";
    at: number;
    responseId?: string;
  },
): OutputAudioBufferTimingResult {
  const at = timestamp(event.at);
  const responseId = event.responseId || "";

  if (event.type === "started") {
    if (current.startedAt > 0) {
      return {
        state: {
          ...current,
          authoritativeEventCount: current.authoritativeEventCount + 1,
        },
        durationMs: null,
        completedAt: null,
        started: false,
        stopped: false,
      };
    }
    return {
      state: {
        startedAt: at,
        responseId,
        authoritativeEventCount: current.authoritativeEventCount + 1,
      },
      durationMs: null,
      completedAt: null,
      started: true,
      stopped: false,
    };
  }

  const matchingResponse = !responseId || !current.responseId || responseId === current.responseId;
  if (current.startedAt <= 0 || !matchingResponse) {
    return {
      state: {
        ...current,
        authoritativeEventCount: current.authoritativeEventCount + 1,
      },
      durationMs: null,
      completedAt: null,
      started: false,
      stopped: false,
    };
  }

  return {
    state: {
      startedAt: 0,
      responseId: "",
      authoritativeEventCount: current.authoritativeEventCount + 1,
    },
    durationMs: Math.max(1, at - current.startedAt),
    completedAt: event.type === "stopped" ? at : null,
    started: false,
    stopped: true,
  };
}

export function flushOutputAudioBufferTiming(
  current: OutputAudioBufferTimingState,
  stoppedAt: number,
): OutputAudioBufferTimingResult {
  if (current.startedAt <= 0) {
    return {
      state: current,
      durationMs: null,
      completedAt: null,
      started: false,
      stopped: false,
    };
  }
  const at = timestamp(stoppedAt);
  return {
    state: {
      startedAt: 0,
      responseId: "",
      authoritativeEventCount: current.authoritativeEventCount,
    },
    durationMs: Math.max(1, at - current.startedAt),
    completedAt: null,
    started: false,
    stopped: true,
  };
}
