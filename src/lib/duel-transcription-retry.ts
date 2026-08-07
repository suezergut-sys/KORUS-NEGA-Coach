export const DUEL_TRANSCRIPTION_ATTEMPTS = 2;
export const DUEL_TRANSCRIPTION_ATTEMPT_TIMEOUT_MS = 120_000;

export type DuelTranscriptionAttemptFailure = {
  attempt: number;
  willRetry: boolean;
  error: ReturnType<typeof duelTranscriptionErrorDetails>;
};

export function duelTranscriptionErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { name: "UnknownError", message: "Unknown failure" };
  const candidate = error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown };
  return {
    name: typeof candidate.name === "string" ? candidate.name : "Error",
    message: typeof candidate.message === "string" ? candidate.message.replace(/\s+/g, " ").slice(0, 500) : "Unknown failure",
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
  };
}

export function isRetryableDuelTranscriptionError(error: unknown) {
  const details = duelTranscriptionErrorDetails(error);
  return details.status === 408 || details.status === 409 || details.status === 429 || Boolean(details.status && details.status >= 500)
    || details.name === "APIConnectionError" || details.name === "APIConnectionTimeoutError" || details.name === "APIUserAbortError"
    || /request was aborted|connection|timed?\s*out/i.test(details.message);
}

export async function runDuelTranscriptionWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  onFailure: (failure: DuelTranscriptionAttemptFailure) => void = () => undefined,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DUEL_TRANSCRIPTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const willRetry = attempt < DUEL_TRANSCRIPTION_ATTEMPTS && isRetryableDuelTranscriptionError(error);
      onFailure({ attempt, willRetry, error: duelTranscriptionErrorDetails(error) });
      if (!willRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}
