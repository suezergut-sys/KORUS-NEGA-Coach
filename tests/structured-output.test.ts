import { describe, expect, it } from "vitest";
import { isRetryableModelError, parseStructuredOutput, StructuredOutputError } from "../src/lib/structured-output";

describe("структурированный ответ модели", () => {
  it("разбирает завершённый JSON-ответ", () => {
    expect(parseStructuredOutput<{ score: number }>({ status: "completed", output_text: '{"score":87}' })).toEqual({ score: 87 });
  });

  it.each([
    [{ status: "incomplete", output_text: "{}", incomplete_details: { reason: "max_output_tokens" } }, "incomplete"],
    [{ status: "completed", output_text: "" }, "empty"],
    [{ status: "completed", output_text: "An error occurred" }, "invalid_json"],
  ] as const)("отклоняет незавершённый или некорректный ответ", (response, code) => {
    expect(() => parseStructuredOutput(response)).toThrowError(StructuredOutputError);
    try {
      parseStructuredOutput(response);
    } catch (error) {
      expect((error as StructuredOutputError).code).toBe(code);
    }
  });

  it("повторяет временные ошибки API и ошибки формата", () => {
    expect(isRetryableModelError(new StructuredOutputError("invalid_json", "bad"))).toBe(true);
    expect(isRetryableModelError({ status: 429 })).toBe(true);
    expect(isRetryableModelError({ status: 500 })).toBe(true);
    expect(isRetryableModelError({ status: 400 })).toBe(false);
  });
});
