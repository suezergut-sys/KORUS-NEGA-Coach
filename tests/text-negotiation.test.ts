import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { textNegotiationInput, textNegotiationModeInstructions, validateTextNegotiationAudio } from "@/lib/text-negotiation";

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

  it("добавляет видимую и причинную эмоциональную динамику только в текстовый кейс 1С", () => {
    const dismissal = textNegotiationModeInstructions("1c-dismissal");
    const anotherCase = textNegotiationModeInstructions("release-risk");

    expect(dismissal).toContain("начинай КАЖДУЮ реплику сотрудника");
    expect(dismissal).toContain("эмоционального настроя в квадратных скобках");
    expect(dismissal).toContain("не знает, что разговор посвящён увольнению");
    expect(dismissal).toContain("На приветствие, вопрос «как дела?»");
    expect(dismissal).toContain("с нейтральной эмоциональной меткой");
    expect(dismissal).toContain("дела нормально");
    expect(dismissal).toContain("ситуации на рынке");
    expect(dismissal).toContain("не упоминай обстоятельства кейса и не начинай возражения");
    expect(dismissal).toContain("После того как руководитель явно назвал увольнение");
    expect(dismissal).toContain("если руководитель отвечает по существу");
    expect(dismissal).toContain("ясно аргументирует решение");
    expect(dismissal).toContain("напряжение и злость усиливаются");
    expect(dismissal).toContain("Одна вежливость без содержательного ответа не улучшает настроение");
    expect(anotherCase).toBe("Это текстовый режим: верни только текст прямой реплики персонажа без озвучки и Markdown. Не добавляй сценические ремарки.");
    expect(anotherCase).not.toContain("квадратных скобках");
  });

  it("accepts audio and rejects non-audio files", () => {
    expect(validateTextNegotiationAudio(new File(["voice"], "turn.webm", { type: "audio/webm" })).name).toBe("turn.webm");
    expect(() => validateTextNegotiationAudio(new File(["text"], "turn.txt", { type: "text/plain" }))).toThrow("формат");
  });
});
