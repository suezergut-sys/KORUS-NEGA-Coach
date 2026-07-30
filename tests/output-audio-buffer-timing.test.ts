import { describe, expect, it } from "vitest";
import {
  applyOutputAudioBufferEvent,
  EMPTY_OUTPUT_AUDIO_BUFFER_TIMING,
  flushOutputAudioBufferTiming,
} from "../src/lib/output-audio-buffer-timing";

describe("output audio buffer timing", () => {
  it("measures the complete WebRTC playback window", () => {
    const started = applyOutputAudioBufferEvent(EMPTY_OUTPUT_AUDIO_BUFFER_TIMING, {
      type: "started",
      at: 1_000,
      responseId: "resp_1",
    });
    const stopped = applyOutputAudioBufferEvent(started.state, {
      type: "stopped",
      at: 6_500,
      responseId: "resp_1",
    });

    expect(started.started).toBe(true);
    expect(stopped).toMatchObject({
      durationMs: 5_500,
      completedAt: 6_500,
      stopped: true,
      state: { startedAt: 0, authoritativeEventCount: 2 },
    });
  });

  it("does not treat an interrupted playback as a completed response", () => {
    const started = applyOutputAudioBufferEvent(EMPTY_OUTPUT_AUDIO_BUFFER_TIMING, {
      type: "started",
      at: 2_000,
      responseId: "resp_2",
    });
    const cleared = applyOutputAudioBufferEvent(started.state, {
      type: "cleared",
      at: 4_000,
      responseId: "resp_2",
    });

    expect(cleared.durationMs).toBe(2_000);
    expect(cleared.completedAt).toBeNull();
  });

  it("ignores a terminal event for another response", () => {
    const started = applyOutputAudioBufferEvent(EMPTY_OUTPUT_AUDIO_BUFFER_TIMING, {
      type: "started",
      at: 2_000,
      responseId: "resp_current",
    });
    const stale = applyOutputAudioBufferEvent(started.state, {
      type: "stopped",
      at: 3_000,
      responseId: "resp_old",
    });

    expect(stale.durationMs).toBeNull();
    expect(stale.state.startedAt).toBe(2_000);
  });

  it("flushes active playback at session end without creating a response pause", () => {
    const started = applyOutputAudioBufferEvent(EMPTY_OUTPUT_AUDIO_BUFFER_TIMING, {
      type: "started",
      at: 5_000,
      responseId: "resp_3",
    });
    const flushed = flushOutputAudioBufferTiming(started.state, 8_000);

    expect(flushed.durationMs).toBe(3_000);
    expect(flushed.completedAt).toBeNull();
  });
});
