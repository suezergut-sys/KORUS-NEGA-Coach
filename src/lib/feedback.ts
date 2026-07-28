export const FEEDBACK_SECTIONS = [
  { value: "negotiations", label: "Переговоры" },
  { value: "account", label: "Личный кабинет" },
  { value: "rating", label: "Рейтинг" },
  { value: "case_upload", label: "Загрузка кейса" },
  { value: "case_builder", label: "Создание своего кейса" },
  { value: "case_analysis", label: "Анализ кейса" },
  { value: "onboarding", label: "Знакомство с сервисом" },
  { value: "other", label: "Другое" },
] as const;

export type FeedbackSection = (typeof FEEDBACK_SECTIONS)[number]["value"];

export type ParsedFeedbackInput = {
  section: FeedbackSection;
  sectionLabel: string;
  customSection: string | null;
  content: string;
};

export const FEEDBACK_AUDIO_MAX_BYTES = 15 * 1024 * 1024;

export function validateFeedbackAudio(value: FormDataEntryValue | null) {
  if (!(value instanceof File)) throw new Error("Запишите голосовое сообщение.");
  if (!value.size) throw new Error("Запись получилась пустой.");
  if (value.size > FEEDBACK_AUDIO_MAX_BYTES) throw new Error("Аудиозапись слишком большая. Запишите сообщение короче.");
  if (!value.type.startsWith("audio/")) throw new Error("Не удалось распознать формат аудиозаписи.");
  return value;
}

export function parseFeedbackInput(value: unknown): ParsedFeedbackInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const section = String(input.section || "") as FeedbackSection;
  const sectionOption = FEEDBACK_SECTIONS.find((item) => item.value === section);
  if (!sectionOption) throw new Error("Выберите раздел или функциональность.");

  const customSection = String(input.customSection || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (section === "other" && !customSection) throw new Error("Укажите раздел или функциональность.");

  const content = String(input.content || "").trim();
  if (!content) throw new Error("Напишите обратную связь.");
  if (content.length > 5000) throw new Error("Обратная связь не должна превышать 5000 символов.");

  return {
    section,
    sectionLabel: section === "other" ? customSection : sectionOption.label,
    customSection: section === "other" ? customSection : null,
    content,
  };
}

export function parseFeedbackStatusInput(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (typeof input.processed !== "boolean") throw new Error("Некорректный статус обратной связи.");
  return { processed: input.processed };
}
