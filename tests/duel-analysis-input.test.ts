import { describe, expect, it } from "vitest";
import {
  buildDuelEmbeddingInput,
  DUEL_EMBEDDING_INPUT_MAX_BYTES,
  excerptUtf8,
} from "../src/lib/duel-analysis-input";

const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

describe("duel analysis embedding input", () => {
  it("keeps short case and transcript unchanged", () => {
    expect(buildDuelEmbeddingInput("Условия кейса", "[00:01] Спикер A: Добрый день")).toBe(
      "КЕЙС:\nУсловия кейса\n\nРАСШИФРОВКА:\n[00:01] Спикер A: Добрый день",
    );
  });

  it("bounds long Russian input below the embedding model token ceiling", () => {
    const result = buildDuelEmbeddingInput("условия ".repeat(2_000), "реплика участника ".repeat(4_000));

    expect(bytes(result)).toBeLessThanOrEqual(DUEL_EMBEDDING_INPUT_MAX_BYTES);
    expect(result).toContain("[фрагмент сокращён]");
    expect(result).toContain("КЕЙС:\nусловия");
    expect(result).toContain("РАСШИФРОВКА:\nреплика участника");
    expect(result.endsWith("участника ")).toBe(true);
  });

  it("does not split Unicode code points when taking an excerpt", () => {
    const result = excerptUtf8("🙂".repeat(100), 100);

    expect(bytes(result)).toBeLessThanOrEqual(100);
    expect(result).not.toContain("�");
  });

  it("respects byte limits smaller than the omission marker", () => {
    const result = excerptUtf8("абвгд", 5);

    expect(bytes(result)).toBeLessThanOrEqual(5);
    expect(result).toBe("аб");
  });
});
