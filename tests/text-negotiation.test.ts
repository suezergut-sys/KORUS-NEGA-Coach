import { describe, expect, it } from "vitest";
import { textNegotiationInput, validateTextNegotiationAudio } from "@/lib/text-negotiation";

describe("текстовый режим переговоров", () => {
  it("maps the visible transcript to user and assistant messages", () => {
    expect(textNegotiationInput([
      { id: "1", author: "Оппонент", text: "Начнём?", time: "10:00" },
      { id: "2", author: "Вы", text: "Да.", time: "10:01" },
    ])).toEqual([
      { role: "assistant", content: "Начнём?" },
      { role: "user", content: "Да." },
    ]);
  });

  it("uses an explicit application request for the first opponent turn", () => {
    expect(textNegotiationInput([], true)).toContain("первую реплику AI-оппонента");
  });

  it("accepts audio and rejects non-audio files", () => {
    expect(validateTextNegotiationAudio(new File(["voice"], "turn.webm", { type: "audio/webm" })).name).toBe("turn.webm");
    expect(() => validateTextNegotiationAudio(new File(["text"], "turn.txt", { type: "text/plain" }))).toThrow("формат");
  });
});
