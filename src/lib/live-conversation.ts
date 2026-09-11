// Live has independent, overlapping caption streams, not Realtime response/item IDs.
export type LiveCaption = { id: string; author: "Вы" | "Оппонент"; text: string; startMs: number; endMs: number };
export class LiveCaptions {
  rows: LiveCaption[] = [];
  private segmentStart = 0;
  readonly segmentStarts: number[] = [0];
  breakTurn() {
    this.segmentStart = this.rows.length;
    this.segmentStarts.push(this.segmentStart);
  }
  private seen = new Set<string>();
  append(event: Record<string, unknown>) {
    const author = event.type === "session.input_transcript.delta" ? "Вы"
      : event.type === "session.output_transcript.delta" ? "Оппонент" : null;
    if (!author || typeof event.delta !== "string" || !event.delta) return null;
    if (typeof event.event_id === "string") {
      if (this.seen.has(event.event_id)) return null;
      this.seen.add(event.event_id);
    }
    const start = Number(event.start_ms), end = Number(event.end_ms);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
    let row = this.rows.slice(this.segmentStart).findLast((r) => r.author === author);
    const other = this.rows.findLast((r) => r.author !== author);
    // A gap is only a display heuristic. It never triggers speech or backend work.
    if (!row || start - row.endMs > 900 || (other && other.endMs >= row.endMs && start >= other.endMs && start > row.endMs)) {
      row = { id: `live-${this.rows.length}`, author, text: "", startMs: start, endMs: end };
      this.rows.push(row);
    }
    row.text += event.delta;
    row.endMs = Math.max(row.endMs, end);
    return { ...row };
  }
}

export function liveInstructions(content: string, eventId?: string) {
  return { type: "session.instructions.append", event_id: eventId, delegation_id: null, content };
}

export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 5000) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); pc.removeEventListener("icegatheringstatechange", changed); resolve(); };
    const changed = () => { if (pc.iceGatheringState === "complete") finish(); };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", changed);
  });
}

export type LiveComparison = {
  latencySource: "browser_audio_energy";
  replyLatenciesMs: number[];
  backendDurationsMs: number[];
  delegationCount: number;
  interruptedCount: number;
};

type Callbacks = {
  onCaption: (caption: LiveCaption) => void;
  onSpeaking: (speaker: "user" | "opponent", speaking: boolean) => void;
  onMetrics: (metrics: LiveComparison) => void;
  onError: (message: string) => void;
  onEvent: (event: Record<string, unknown>) => void;
};

export class LiveConversation {
  readonly captions = new LiveCaptions();
  readonly metrics: LiveComparison = { latencySource: "browser_audio_energy", replyLatenciesMs: [], backendDurationsMs: [], delegationCount: 0, interruptedCount: 0 };
  readonly ready: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private started = false;
  private paused = false;
  private closing = false;
  private closed = false;
  private pendingReplyAt = 0;
  private speaking = { user: false, opponent: false };
  private backendStarts = new Map<string, number>();
  private context: AudioContext;
  private meters: Array<() => void> = [];
  private readyTimeout: ReturnType<typeof setTimeout>;
  private finalResolve?: () => void;

  constructor(private channel: RTCDataChannel, private callbacks: Callbacks) {
    this.context = new AudioContext();
    void this.context.resume().catch(() => callbacks.onError("Не удалось включить измерение звука в браузере."));
    this.ready = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    // Handled here as well as by the caller after SDP negotiation.
    void this.ready.catch(() => undefined);
    this.readyTimeout = setTimeout(() => this.readyReject(new Error("GPT-Live не подтвердил запуск сессии.")), 30_000);
    channel.addEventListener("message", this.receive);
  }

  send(event: Record<string, unknown>) {
    if (this.channel.readyState === "open") this.channel.send(JSON.stringify(event));
  }

  private receive = (message: MessageEvent) => {
    let event: Record<string, unknown>;
    try { event = JSON.parse(String(message.data)); } catch { return; }
    this.callbacks.onEvent(event);
    if (event.type === "session.started") {
      this.started = true;
      clearTimeout(this.readyTimeout);
      this.readyResolve();
    }
    if (event.type === "error") {
      const message = "Ошибка GPT-Live. Если диалог остановился, завершите его для сохранения стенограммы.";
      if (!this.started) this.readyReject(new Error(message));
      this.callbacks.onError(message);
    }
    if (event.type === "session.closed") {
      this.closed = true;
      this.finalResolve?.();
      if (!this.closing) this.callbacks.onError("Сессия GPT-Live закрылась. Завершите поединок для сохранения и анализа.");
    }
    if (event.type === "session.delegation.created") {
      this.metrics.delegationCount += 1;
      const delegation = event.delegation as { id?: string; response_id?: string } | undefined;
      const id = delegation?.id || String(event.delegation_id || event.response_id || "");
      if (id) this.backendStarts.set(id, performance.now());
      this.callbacks.onMetrics(this.metrics);
    }
    if (event.type === "response.event" && event.event && typeof event.event === "object") {
      const inner = event.event as Record<string, unknown>;
      if (["response.completed", "response.failed", "response.incomplete"].includes(String(inner.type))) {
        const response = inner.response as { id?: string } | undefined;
        const id = String(event.delegation_id || response?.id || event.response_id || "");
        const start = this.backendStarts.get(id);
        if (start !== undefined) { this.metrics.backendDurationsMs.push(performance.now() - start); this.backendStarts.delete(id); }
        if (inner.type !== "response.completed") this.callbacks.onError("Не удалось завершить обдумывание позиции. Повторите предложение или завершите поединок.");
        this.callbacks.onMetrics(this.metrics);
      }
    }
    if (this.paused) return; // Muted generated speech must not become the participant's heard transcript.
    const caption = this.captions.append(event);
    if (caption) this.callbacks.onCaption(caption);
  };

  greet(instructions: string) {
    // The entire append stays well below the API's 500-token limit.
    this.send(liveInstructions(`Начни первым сейчас. Только русский язык. ${instructions.slice(0, 900)} Затем слушай пользователя.`, "live-greeting"));
  }

  monitor(stream: MediaStream, speaker: "user" | "opponent") {
    const source = this.context.createMediaStreamSource(stream);
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let lastSound = 0, candidateAt = 0;
    const timer = setInterval(() => {
      if (!this.started || this.paused || this.closing) return;
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
      const now = performance.now();
      if (rms > (speaker === "user" ? 0.018 : 0.009)) {
        lastSound = now;
        if (!candidateAt) candidateAt = now;
        if (!this.speaking[speaker] && now - candidateAt >= 80) {
          this.speaking[speaker] = true;
          if (speaker === "user") {
            this.pendingReplyAt = 0;
            if (this.speaking.opponent) this.metrics.interruptedCount += 1;
          } else if (this.pendingReplyAt && !this.speaking.user) {
            this.metrics.replyLatenciesMs.push(Math.max(0, candidateAt - this.pendingReplyAt));
            this.pendingReplyAt = 0;
          }
          this.callbacks.onSpeaking(speaker, true);
          this.callbacks.onMetrics(this.metrics);
        }
      } else if (now - lastSound > 300) {
        candidateAt = 0;
        if (this.speaking[speaker]) {
          this.speaking[speaker] = false;
          if (speaker === "user") this.pendingReplyAt = lastSound;
          this.callbacks.onSpeaking(speaker, false);
        }
      }
    }, 40);
    this.meters.push(() => { clearInterval(timer); source.disconnect(); analyser.disconnect(); });
  }

  setPaused(paused: boolean) {
    if (paused === this.paused || !this.started || this.closing) return;
    this.paused = paused;
    this.captions.breakTurn();
    this.pendingReplyAt = 0;
    this.speaking = { user: false, opponent: false };
    this.callbacks.onSpeaking("user", false);
    this.callbacks.onSpeaking("opponent", false);
    this.send({ type: paused ? "session.input_audio.mute" : "session.input_audio.unmute" });
    this.send(liveInstructions(paused
      ? "Приложение поставило переговоры на паузу. Молчи до команды возобновления. Не принимай новых решений."
      : "Пауза закончилась. Пользователь не слышал речь во время паузы. Не считай её ответом или соглашением. Слушай следующую реплику пользователя; по ней уточни актуальную позицию у backend."));
  }

  async finish() {
    if (this.closed) return;
    this.closing = true;
    // Allow late transcript fragments to arrive before the terminal snapshot.
    this.send({ type: "session.input_audio.mute" });
    await new Promise((resolve) => setTimeout(resolve, 900));
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 4000);
      this.finalResolve = () => { clearTimeout(timeout); resolve(); };
      this.send({ type: "session.close" });
    });
    if (!this.closed) this.callbacks.onError("Не получено подтверждение закрытия Live; сохранены все полученные фрагменты стенограммы.");
  }

  dispose() {
    clearTimeout(this.readyTimeout);
    if (!this.closed) this.send({ type: "session.close" });
    this.closing = true;
    this.channel.removeEventListener("message", this.receive);
    this.meters.forEach((stop) => stop());
    void this.context.close();
  }
}
