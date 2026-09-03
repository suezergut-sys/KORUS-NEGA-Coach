import { describe, expect, it } from "vitest";
import {
  buildDuelEmbeddingInputs,
  DUEL_EMBEDDING_INPUT_MAX_BYTES,
} from "../src/lib/duel-analysis-input";
import { splitEmbeddingText } from "../src/lib/embedding-input";

const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

describe("duel analysis embedding inputs", () => {
  it("keeps short case and transcript in separate searchable inputs", () => {
    expect(buildDuelEmbeddingInputs("Условия кейса", "[00:01] Спикер A: Добрый день")).toEqual([
      "КЕЙС:\nУсловия кейса",
      "РАСШИФРОВКА:\n[00:01] Спикер A: Добрый день",
    ]);
  });

  it("bounds every long Russian input without dropping the beginning, middle or end", () => {
    const caseText = "условия кейса\n".repeat(2_000);
    const transcriptText = "реплика участника\n".repeat(4_000);
    const result = buildDuelEmbeddingInputs(caseText, transcriptText);

    expect(result.length).toBeGreaterThan(2);
    expect(result.every((item) => bytes(item) <= DUEL_EMBEDDING_INPUT_MAX_BYTES)).toBe(true);
    expect(result.some((item) => item.includes("КЕЙС — часть 1/"))).toBe(true);
    expect(result.some((item) => item.includes("РАСШИФРОВКА — часть 2/"))).toBe(true);
    expect(result.at(-1)?.endsWith("реплика участника\n")).toBe(true);
    expect(result
      .filter((item) => item.startsWith("РАСШИФРОВКА"))
      .map((item) => item.slice(item.indexOf("\n") + 1))
      .join("")).toBe(transcriptText);
  });

  it("preserves all text and does not split Unicode code points", () => {
    const source = `${"🙂".repeat(3_000)}\n${"переговоры ".repeat(2_000)}`;
    const result = splitEmbeddingText(source, 1_000);

    expect(result.every((item) => bytes(item) <= 1_000)).toBe(true);
    expect(result.join("")).toBe(source);
    expect(result.join("")).not.toContain("�");
  });
});
