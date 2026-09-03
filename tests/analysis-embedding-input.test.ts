import { describe, expect, it } from "vitest";
import { buildTrainingEmbeddingInputs } from "../src/lib/analysis-embedding-input";
import {
  batchEmbeddingInputs,
  EMBEDDING_BATCH_MAX_BYTES,
  EMBEDDING_INPUT_MAX_BYTES,
  utf8Bytes,
} from "../src/lib/embedding-input";

describe("training analysis embedding inputs", () => {
  it("covers a long Russian negotiation without sending an oversized item", () => {
    const transcript = Array.from({ length: 60 }, (_, index) =>
      `${index + 1}. ${index % 2 ? "Оппонент" : "Вы"}: ${"содержательная реплика ".repeat(18)}\n`).join("");
    const inputs = buildTrainingEmbeddingInputs({
      caseContext: "Подробный контекст кейса. ".repeat(240),
      caseGoal: "Достичь устойчивой договорённости.",
      caseConstraints: ["Сохранить отношения", "Зафиксировать следующие шаги"],
      transcript,
    });

    expect(inputs.length).toBeGreaterThan(2);
    expect(inputs.every((item) => utf8Bytes(item) <= EMBEDDING_INPUT_MAX_BYTES)).toBe(true);
    expect(inputs.some((item) => item.includes("СТЕНОГРАММА — часть 1/"))).toBe(true);
    expect(inputs.at(-1)?.endsWith("содержательная реплика \n")).toBe(true);
    expect(inputs
      .filter((item) => item.startsWith("СТЕНОГРАММА"))
      .map((item) => item.slice(item.indexOf("\n") + 1))
      .join("")).toBe(transcript);
  });

  it("batches every input under the aggregate request budget", () => {
    const inputs = Array.from({ length: 70 }, (_, index) => `${index}: ${"я".repeat(3_500)}`);
    const batches = batchEmbeddingInputs(inputs);

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(inputs);
    expect(batches.every((batch) =>
      batch.reduce((total, item) => total + utf8Bytes(item), 0) <= EMBEDDING_BATCH_MAX_BYTES)).toBe(true);
  });
});
