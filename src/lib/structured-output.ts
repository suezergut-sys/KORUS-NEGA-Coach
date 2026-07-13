export type StructuredResponseLike = {
  status?: string | null;
  output_text?: string | null;
  incomplete_details?: { reason?: string | null } | null;
};

export class StructuredOutputError extends Error {
  constructor(
    public readonly code: "incomplete" | "empty" | "invalid_json",
    message: string,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export function parseStructuredOutput<T>(response: StructuredResponseLike): T {
  if (response.status && response.status !== "completed") {
    const reason = response.incomplete_details?.reason || response.status;
    throw new StructuredOutputError("incomplete", `Ответ модели не завершён: ${reason}.`);
  }

  const output = response.output_text?.trim();
  if (!output) throw new StructuredOutputError("empty", "Модель вернула пустой ответ.");

  try {
    return JSON.parse(output) as T;
  } catch {
    throw new StructuredOutputError("invalid_json", "Модель вернула ответ в неверном формате.");
  }
}

export function isRetryableModelError(error: unknown) {
  if (error instanceof StructuredOutputError) return true;
  if (!error || typeof error !== "object") return false;

  const candidate = error as { status?: unknown; name?: unknown };
  const status = typeof candidate.status === "number" ? candidate.status : 0;
  return status === 408 || status === 409 || status === 429 || status >= 500 ||
    candidate.name === "APIConnectionError" || candidate.name === "APIConnectionTimeoutError";
}
