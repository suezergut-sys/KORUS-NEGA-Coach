export function updateTurnDetection(channel: RTCDataChannel | null, eagerness: "low" | "high") {
  if (channel?.readyState !== "open") return;
  channel.send(JSON.stringify({
    type: "session.update",
    session: {
      type: "realtime",
      audio: {
        input: {
          turn_detection: {
            type: "semantic_vad",
            eagerness,
            create_response: true,
            interrupt_response: true,
          },
        },
      },
    },
  }));
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
