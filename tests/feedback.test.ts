import { describe, expect, it } from "vitest";
import {
  FEEDBACK_SECTIONS,
  FEEDBACK_AUDIO_MAX_BYTES,
  parseFeedbackInput,
  parseFeedbackStatusInput,
  validateFeedbackAudio,
} from "../src/lib/feedback";

describe("feedback input", () => {
  it("accepts a predefined section and trims the message", () => {
    expect(parseFeedbackInput({
      section: "negotiations",
      content: "  Добавьте повтор последней реплики.  ",
    })).toEqual({
      section: "negotiations",
      sectionLabel: "Переговоры",
      customSection: null,
      content: "Добавьте повтор последней реплики.",
    });
  });

  it("requires a custom label for the Other section", () => {
    expect(() => parseFeedbackInput({
      section: "other",
      customSection: " ",
      content: "Комментарий",
    })).toThrow("Укажите раздел или функциональность.");
  });

  it("rejects empty and oversized feedback", () => {
    expect(() => parseFeedbackInput({ section: "rating", content: " " })).toThrow("Напишите обратную связь.");
    expect(() => parseFeedbackInput({ section: "rating", content: "а".repeat(5001) })).toThrow("Обратная связь не должна превышать 5000 символов.");
  });

  it("exposes stable user-facing section options", () => {
    expect(FEEDBACK_SECTIONS.map((item) => item.value)).toEqual([
      "negotiations",
      "account",
      "rating",
      "case_upload",
      "case_builder",
      "case_analysis",
      "onboarding",
      "other",
    ]);
  });
});

describe("feedback processing status", () => {
  it("accepts only a boolean processed value", () => {
    expect(parseFeedbackStatusInput({ processed: true })).toEqual({ processed: true });
    expect(() => parseFeedbackStatusInput({ processed: "true" })).toThrow("Некорректный статус обратной связи.");
  });
});

describe("feedback audio", () => {
  it("accepts a non-empty browser audio recording", () => {
    const audio = new File(["voice"], "feedback.webm", { type: "audio/webm" });
    expect(validateFeedbackAudio(audio)).toBe(audio);
  });

  it("rejects missing, empty, and oversized recordings", () => {
    expect(() => validateFeedbackAudio(null)).toThrow("Запишите голосовое сообщение.");
    expect(() => validateFeedbackAudio(new File([], "feedback.webm", { type: "audio/webm" }))).toThrow("Запись получилась пустой.");
    const oversized = new File([new Uint8Array(FEEDBACK_AUDIO_MAX_BYTES + 1)], "feedback.webm", { type: "audio/webm" });
    expect(() => validateFeedbackAudio(oversized)).toThrow("Аудиозапись слишком большая.");
  });
});
