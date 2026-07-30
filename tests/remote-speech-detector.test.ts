import { describe, expect, it } from "vitest";
import { createRemoteSpeechDetector } from "../src/lib/remote-speech-detector";

describe("remote speech detector", () => {
  it("uses hysteresis to emit one start and one stop for a spoken segment", () => {
    const detector = createRemoteSpeechDetector();

    expect(detector.sample(0.02, 1_000)).toBeNull();
    expect(detector.sample(0.03, 1_100)).toEqual({ type: "started", at: 1_000 });
    expect(detector.sample(0.01, 1_250)).toBeNull();
    expect(detector.sample(0.004, 1_300)).toBeNull();
    expect(detector.sample(0.003, 1_600)).toEqual({ type: "stopped", at: 1_300 });
  });

  it("ignores short noise and short gaps inside speech", () => {
    const detector = createRemoteSpeechDetector();

    expect(detector.sample(0.02, 100)).toBeNull();
    expect(detector.sample(0, 150)).toBeNull();
    expect(detector.sample(0.02, 200)).toBeNull();
    expect(detector.sample(0.02, 300)).toEqual({ type: "started", at: 200 });
    expect(detector.sample(0, 400)).toBeNull();
    expect(detector.sample(0.02, 600)).toBeNull();
  });

  it("flushes active speech when the session ends", () => {
    const detector = createRemoteSpeechDetector({ minimumVoiceMs: 0 });

    expect(detector.sample(0.02, 500)).toEqual({ type: "started", at: 500 });
    expect(detector.stop(900)).toEqual({ type: "stopped", at: 900 });
    expect(detector.stop(1_000)).toBeNull();
  });
});
