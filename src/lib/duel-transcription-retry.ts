export const DUEL_TRANSCRIPTION_ATTEMPTS = 2;
export const DUEL_TRANSCRIPTION_TOTAL_TIMEOUT_MS = 292_000;
export const DUEL_TRANSCRIPTION_MIN_RETRY_BUDGET_MS = 240_000;
const RETRY_DELAY_MS = 500;

export type DuelTranscriptionAttemptFailure = {
  attempt: number;
  timeoutMs: number;
  willRetry: boolean;
  error: ReturnType<typeof duelTranscriptionErrorDetails>;
};

type RetryOptions = {
  startedAtMs?: number;
  totalTimeoutMs?: number;
  minRetryBudgetMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
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
  operation: (attempt: number, timeoutMs: number) => Promise<T>,
  onFailure: (failure: DuelTranscriptionAttemptFailure) => void = () => undefined,
  options: RetryOptions = {},
) {
  const now = options.now || Date.now;
  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const startedAtMs = options.startedAtMs ?? now();
  const totalTimeoutMs = options.totalTimeoutMs ?? DUEL_TRANSCRIPTION_TOTAL_TIMEOUT_MS;
  const minRetryBudgetMs = options.minRetryBudgetMs ?? DUEL_TRANSCRIPTION_MIN_RETRY_BUDGET_MS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= DUEL_TRANSCRIPTION_ATTEMPTS; attempt += 1) {
    const timeoutMs = Math.max(1, totalTimeoutMs - (now() - startedAtMs));
    try {
      return await operation(attempt, timeoutMs);
    } catch (error) {
      lastError = error;
      const retryBudgetMs = totalTimeoutMs - (now() - startedAtMs) - RETRY_DELAY_MS;
      const willRetry = attempt < DUEL_TRANSCRIPTION_ATTEMPTS
        && retryBudgetMs >= minRetryBudgetMs
        && isRetryableDuelTranscriptionError(error);
      onFailure({ attempt, timeoutMs, willRetry, error: duelTranscriptionErrorDetails(error) });
      if (!willRetry) throw error;
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
