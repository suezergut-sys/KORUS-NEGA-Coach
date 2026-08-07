import { describe, expect, it, vi } from "vitest";
import {
  isRetryableDuelTranscriptionError,
  runDuelTranscriptionWithRetry,
} from "../src/lib/duel-transcription-retry";

describe("duel transcription retries", () => {
  it("retries a transient aborted request with a fresh attempt", async () => {
    let now = 10_000;
    const seenTimeouts: number[] = [];
    const operation = vi.fn(async (attempt: number, timeoutMs: number) => {
      seenTimeouts.push(timeoutMs);
      now += 1_000;
      if (attempt === 1) throw Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" });
      return "transcript";
    });
    const failures: unknown[] = [];

    await expect(runDuelTranscriptionWithRetry(
      operation,
      (failure) => failures.push(failure),
      { startedAtMs: now, now: () => now, sleep: async (milliseconds) => { now += milliseconds; } },
    )).resolves.toBe("transcript");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(seenTimeouts).toEqual([292_000, 290_500]);
    expect(failures).toMatchObject([{ attempt: 1, timeoutMs: 292_000, willRetry: true }]);
  });

  it("does not retry validation or other permanent failures", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Unsupported audio."));

    await expect(runDuelTranscriptionWithRetry(operation)).rejects.toThrow("Unsupported audio.");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not restart a long request when too little Vercel time remains", async () => {
    let now = 0;
    const operation = vi.fn(async () => {
      now = 120_000;
      throw new Error("Request was aborted.");
    });
    const failures: unknown[] = [];

    await expect(runDuelTranscriptionWithRetry(
      operation,
      (failure) => failures.push(failure),
      { startedAtMs: 0, now: () => now, sleep: async () => undefined },
    )).rejects.toThrow("Request was aborted.");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(failures).toMatchObject([{ attempt: 1, timeoutMs: 292_000, willRetry: false }]);
  });

  it("recognizes retryable transport and service errors", () => {
    expect(isRetryableDuelTranscriptionError({ status: 503, message: "Unavailable" })).toBe(true);
    expect(isRetryableDuelTranscriptionError(new Error("Connection timed out"))).toBe(true);
    expect(isRetryableDuelTranscriptionError({ status: 400, message: "Bad request" })).toBe(false);
  });
});
