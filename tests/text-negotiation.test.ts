import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { textNegotiationInput, validateTextNegotiationAudio } from "@/lib/text-negotiation";

describe("текстовый режим переговоров", () => {
  it("выделяет стенограмме увеличенную область и оставляет компактный ввод", () => {
    const arena = readFileSync("src/components/VoiceArena.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");
    expect(arena).toContain('inputMode === "text_only" ? "dialogue-surface text-only"');
    expect(arena).toContain("rows={2}");
    expect(styles).toMatch(/\.dialogue-surface\.text-only\s*\{[^}]*height:\s*clamp\(560px,\s*68vh,\s*680px\)/);
    expect(styles).toMatch(/\.dialogue-surface\.text-only \.dialogue-list\s*\{[^}]*max-height:\s*none/);
    expect(styles).toMatch(/\.text-negotiation-composer textarea\s*\{[^}]*min-height:\s*56px/);
  });
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
