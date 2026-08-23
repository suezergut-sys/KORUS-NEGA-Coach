import { describe, expect, it } from "vitest";
import {
  buildVerbatimTranscriptionPrompt,
  finalTranscriptText,
  spokenWordSequence,
  transcriptWordErrorRate,
  VERBATIM_TRANSCRIPTION_PROMPT,
} from "@/lib/transcription";

describe("verbatim voice transcription", () => {
  it("keeps the final recognizer wording unchanged", () => {
    const transcript = "Ну, я, я думаю, что компенсация, ну, будет не меньше.";

    expect(finalTranscriptText(transcript)).toBe(transcript);
  });

  it("only removes transport whitespace around the final transcript", () => {
    expect(finalTranscriptText("  Если это выпадает на последний день.\n")).toBe("Если это выпадает на последний день.");
    expect(finalTranscriptText(null)).toBe("");
  });

  it("compares spoken wording without treating punctuation as a spoken word", () => {
    expect(spokenWordSequence("Давайте, спокойно — определим причины.")).toEqual([
      "давайте",
      "спокойно",
      "определим",
      "причины",
    ]);
  });

  it("measures substitutions, omissions and additions in recognized wording", () => {
    expect(transcriptWordErrorRate("ну давайте спокойно", "ну давайте спокойно")).toBe(0);
    expect(transcriptWordErrorRate("ну давайте спокойно", "мы давайте спокойно")).toBeCloseTo(1 / 3);
    expect(transcriptWordErrorRate("ну давайте спокойно", "ну спокойно")).toBeCloseTo(1 / 3);
  });

  it("explicitly forbids rewriting spoken wording", () => {
    expect(VERBATIM_TRANSCRIPTION_PROMPT).toContain("повторы");
    expect(VERBATIM_TRANSCRIPTION_PROMPT).toContain("слова-паразиты");
    expect(VERBATIM_TRANSCRIPTION_PROMPT).toContain("Не перефразируй");
    expect(VERBATIM_TRANSCRIPTION_PROMPT).toContain("не исправляй");
    expect(buildVerbatimTranscriptionPrompt("термины 1С")).toContain("Контекст записи: термины 1С");
  });
});
