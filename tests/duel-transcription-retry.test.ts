import { describe, expect, it, vi } from "vitest";
import {
  isRetryableDuelTranscriptionError,
  runDuelTranscriptionWithRetry,
} from "../src/lib/duel-transcription-retry";

describe("duel transcription retries", () => {
  it("retries a transient aborted request with a fresh attempt", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" }))
      .mockResolvedValueOnce("transcript");
    const failures: unknown[] = [];

    await expect(runDuelTranscriptionWithRetry(operation, (failure) => failures.push(failure))).resolves.toBe("transcript");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(failures).toMatchObject([{ attempt: 1, willRetry: true }]);
  });

  it("does not retry validation or other permanent failures", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Unsupported audio."));

    await expect(runDuelTranscriptionWithRetry(operation)).rejects.toThrow("Unsupported audio.");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("recognizes retryable transport and service errors", () => {
    expect(isRetryableDuelTranscriptionError({ status: 503, message: "Unavailable" })).toBe(true);
    expect(isRetryableDuelTranscriptionError(new Error("Connection timed out"))).toBe(true);
    expect(isRetryableDuelTranscriptionError({ status: 400, message: "Bad request" })).toBe(false);
  });
});
