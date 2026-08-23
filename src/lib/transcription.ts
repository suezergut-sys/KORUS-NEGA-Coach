export const VERBATIM_TRANSCRIPTION_PROMPT = [
  "Дословная стенограмма русскоязычной речи пользователя KORUS NEGA AI.",
  "Сохраняй все произнесённые слова, исходный порядок слов, повторы, самоисправления, обрывы фраз и слова-паразиты.",
  "Не перефразируй, не дополняй, не сокращай и не исправляй формулировки или грамматику говорящего.",
].join(" ");

export function buildVerbatimTranscriptionPrompt(context: string) {
  return `${VERBATIM_TRANSCRIPTION_PROMPT} Контекст записи: ${context.trim()}`;
}

export function finalTranscriptText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function spokenWordSequence(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е")
    .match(/[\p{L}\p{N}]+/gu) || [];
}

export function transcriptWordErrorRate(expected: string, recognized: string) {
  const reference = spokenWordSequence(expected);
  const hypothesis = spokenWordSequence(recognized);
  if (reference.length === 0) return hypothesis.length === 0 ? 0 : 1;

  const previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let referenceIndex = 1; referenceIndex <= reference.length; referenceIndex += 1) {
    const current = [referenceIndex];
    for (let hypothesisIndex = 1; hypothesisIndex <= hypothesis.length; hypothesisIndex += 1) {
      const substitution = previous[hypothesisIndex - 1]
        + (reference[referenceIndex - 1] === hypothesis[hypothesisIndex - 1] ? 0 : 1);
      current[hypothesisIndex] = Math.min(
        previous[hypothesisIndex] + 1,
        current[hypothesisIndex - 1] + 1,
        substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[hypothesis.length] / reference.length;
}
