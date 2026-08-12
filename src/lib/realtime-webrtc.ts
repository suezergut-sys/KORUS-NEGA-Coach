export type RealtimeTurnEagerness = "low" | "high";

type RealtimeEvent = Record<string, unknown>;

export function buildRealtimeResponseEvent(): RealtimeEvent {
  return {
    type: "response.create",
    response: {
      output_modalities: ["audio"],
    },
  };
}

export function buildRealtimeResponseEvents(instructions?: string): RealtimeEvent[] {
  const responseEvent = buildRealtimeResponseEvent();
  const responseInstructions = instructions?.trim();
  if (!responseInstructions) return [responseEvent];

  return [
    {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: responseInstructions }],
      },
    },
    responseEvent,
  ];
}

function sendRealtimeEvents(channel: RTCDataChannel | null, events: RealtimeEvent[]) {
  if (channel?.readyState !== "open") return false;
  events.forEach((event) => channel.send(JSON.stringify(event)));
  return true;
}

export function buildTurnDetectionEvent(eagerness: RealtimeTurnEagerness): RealtimeEvent {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      audio: {
        input: {
          turn_detection: {
            type: "semantic_vad",
            eagerness,
            create_response: false,
            interrupt_response: false,
          },
        },
      },
    },
  };
}

export function buildPauseRealtimeEvents(options: {
  responseActive: boolean;
  opponentPlaybackActive: boolean;
  assistantItemId?: string;
  audioEndMs?: number;
}): RealtimeEvent[] {
  const events: RealtimeEvent[] = [{
    type: "session.update",
    session: {
      type: "realtime",
      audio: { input: { turn_detection: null } },
    },
  }];

  if (options.responseActive || options.opponentPlaybackActive) {
    events.push({ type: "response.cancel" });
  }
  if (options.opponentPlaybackActive) {
    events.push({ type: "output_audio_buffer.clear" });
  }
  if (
    options.opponentPlaybackActive
    && options.assistantItemId
    && Number.isFinite(options.audioEndMs)
  ) {
    events.push({
      type: "conversation.item.truncate",
      item_id: options.assistantItemId,
      content_index: 0,
      audio_end_ms: Math.max(0, Math.floor(options.audioEndMs || 0)),
    });
  }

  // Не даём фоновому шуму или незавершённому VAD-ходу запустить скрытый ответ.
  events.push({ type: "input_audio_buffer.clear" });
  return events;
}

export function pauseRealtime(channel: RTCDataChannel | null, options: Parameters<typeof buildPauseRealtimeEvents>[0]) {
  return sendRealtimeEvents(channel, buildPauseRealtimeEvents(options));
}

export function buildBargeInRealtimeEvents(options: {
  responseActive: boolean;
  opponentPlaybackActive: boolean;
  assistantItemId?: string;
  audioEndMs?: number;
}): RealtimeEvent[] {
  const events: RealtimeEvent[] = [];
  if (options.responseActive) events.push({ type: "response.cancel" });
  if (options.opponentPlaybackActive) events.push({ type: "output_audio_buffer.clear" });
  if (
    options.opponentPlaybackActive
    && options.assistantItemId
    && Number.isFinite(options.audioEndMs)
  ) {
    events.push({
      type: "conversation.item.truncate",
      item_id: options.assistantItemId,
      content_index: 0,
      audio_end_ms: Math.max(0, Math.floor(options.audioEndMs || 0)),
    });
  }
  return events;
}

export function bargeInRealtime(channel: RTCDataChannel | null, options: Parameters<typeof buildBargeInRealtimeEvents>[0]) {
  const events = buildBargeInRealtimeEvents(options);
  return events.length > 0 && sendRealtimeEvents(channel, events);
}

export function buildResumeRealtimeEvents(options: {
  eagerness: RealtimeTurnEagerness;
  continueOpponent: boolean;
  opponentWasAudible: boolean;
}): RealtimeEvent[] {
  const events = [buildTurnDetectionEvent(options.eagerness)];
  if (options.continueOpponent) {
    events.push(...buildRealtimeResponseEvents(options.opponentWasAudible
      ? "Продолжи прерванную реплику оппонента точно с места остановки. Не повторяй уже сказанное, не начинай новую мысль и не добавляй вступление."
      : "Возобнови прерванную реплику оппонента. Пользователь ещё не слышал её начало, поэтому произнеси реплику с начала без вступления."));
  }
  return events;
}

export function resumeRealtime(channel: RTCDataChannel | null, options: Parameters<typeof buildResumeRealtimeEvents>[0]) {
  return sendRealtimeEvents(channel, buildResumeRealtimeEvents(options));
}

export function updateTurnDetection(channel: RTCDataChannel | null, eagerness: RealtimeTurnEagerness) {
  if (channel?.readyState !== "open") return;
  channel.send(JSON.stringify(buildTurnDetectionEvent(eagerness)));
}

export function requestRealtimeResponse(channel: RTCDataChannel | null, instructions?: string) {
  return sendRealtimeEvents(channel, buildRealtimeResponseEvents(instructions));
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 25_000,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export function waitForDataChannelOpen(channel: RTCDataChannel, timeoutMs = 25_000) {
  if (channel.readyState === "open") return Promise.resolve();
  if (channel.readyState !== "connecting") {
    return Promise.reject(new Error("Голосовой канал закрылся до подключения."));
  }
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

export function closeRealtimeConnection(resources: {
  channel: RTCDataChannel | null;
  peer: RTCPeerConnection | null;
  stream: MediaStream | null;
  audio: HTMLAudioElement | null;
}) {
  resources.channel?.close();
  resources.peer?.close();
  resources.stream?.getTracks().forEach((track) => track.stop());
  if (resources.audio) resources.audio.srcObject = null;
}
