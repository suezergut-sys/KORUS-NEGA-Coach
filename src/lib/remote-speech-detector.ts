export const REMOTE_SPEECH_STOP_LEVEL = 0.008;

export type RemoteSpeechTransition =
  | { type: "started"; at: number }
  | { type: "stopped"; at: number };

type RemoteSpeechDetectorOptions = {
  startLevel?: number;
  stopLevel?: number;
  minimumVoiceMs?: number;
  minimumSilenceMs?: number;
};

export function createRemoteSpeechDetector(options: RemoteSpeechDetectorOptions = {}) {
  const startLevel = options.startLevel ?? 0.015;
  const stopLevel = options.stopLevel ?? REMOTE_SPEECH_STOP_LEVEL;
  const minimumVoiceMs = options.minimumVoiceMs ?? 100;
  const minimumSilenceMs = options.minimumSilenceMs ?? 300;
  let speaking = false;
  let voiceStartedAt: number | null = null;
  let silenceStartedAt: number | null = null;

  return {
    sample(audioLevel: number, sampledAt: number): RemoteSpeechTransition | null {
      const level = Number.isFinite(audioLevel) ? Math.max(0, audioLevel) : 0;

      if (!speaking) {
        silenceStartedAt = null;
        if (level < startLevel) {
          voiceStartedAt = null;
          return null;
        }
        voiceStartedAt ??= sampledAt;
        if (sampledAt - voiceStartedAt < minimumVoiceMs) return null;
        speaking = true;
        const startedAt = voiceStartedAt;
        voiceStartedAt = null;
        return { type: "started", at: startedAt };
      }

      if (level > stopLevel) {
        silenceStartedAt = null;
        return null;
      }
      silenceStartedAt ??= sampledAt;
      if (sampledAt - silenceStartedAt < minimumSilenceMs) return null;
      speaking = false;
      const stoppedAt = silenceStartedAt;
      silenceStartedAt = null;
      return { type: "stopped", at: stoppedAt };
    },

    stop(stoppedAt: number): RemoteSpeechTransition | null {
      voiceStartedAt = null;
      if (!speaking) return null;
      speaking = false;
      const transition = { type: "stopped" as const, at: silenceStartedAt ?? stoppedAt };
      silenceStartedAt = null;
      return transition;
    },
  };
}
