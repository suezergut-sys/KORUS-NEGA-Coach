export const INCOMPLETE_TURN_CLARIFICATION_DELAY_MS = 3_500;

export const INCOMPLETE_TURN_CLARIFICATION_INSTRUCTIONS =
  "Пользователь произнёс только незавершённый фрагмент реплики. Не додумывай его позицию, намерение или аргументы. Одной короткой нейтральной фразой попроси пользователя закончить мысль.";

const COMPLETE_SHORT_REPLIES = new Set([
  "да", "нет", "согласен", "согласна", "не согласен", "не согласна",
  "готов", "готова", "не готов", "не готова", "отказываюсь", "принимаю",
  "дорого", "поздно", "договорились", "давайте", "продолжайте", "подождите",
]);

const INCOMPLETE_FRAGMENTS = new Set([
  "я", "мы", "мне", "нам", "мой", "моя", "моё", "мои", "наш", "наша",
  "ну", "а", "и", "но", "потому", "потому что", "если", "когда", "хотя",
  "просто", "значит", "это", "то", "что", "как", "чтобы", "для", "про",
]);

const TRAILING_CONNECTOR = /(?:^|\s)(?:а|и|но|или|потому|потому что|если|когда|хотя|что|чтобы|для|про|с|без|к|от|до|из|на|в|по|при)$/iu;

function normalize(text: string) {
  return text
    .toLocaleLowerCase("ru-RU")
    .replace(/[«»"'()[\]{}.,!?…:;—–-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function combineUserTurnFragments(fragments: readonly string[], nextText: string) {
  return [...fragments, nextText]
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function isIncompleteUserTurn(text: string) {
  const normalized = normalize(text);
  if (!normalized || COMPLETE_SHORT_REPLIES.has(normalized)) return false;
  if (INCOMPLETE_FRAGMENTS.has(normalized)) return true;
  if (TRAILING_CONNECTOR.test(normalized)) return true;

  const words = normalized.split(" ");
  if (words.length <= 2 && /^(?:я|мы|мне|нам)$/iu.test(words[0])) {
    return !/(?:соглас|готов|отказ|принима|против|за)$/iu.test(words.at(-1) || "");
  }
  return false;
}

export function evaluateUserTurn(fragments: readonly string[], nextText: string) {
  const combinedText = combineUserTurnFragments(fragments, nextText);
  return {
    combinedText,
    shouldRespond: Boolean(combinedText) && !isIncompleteUserTurn(combinedText),
  };
}

export function shouldContinueOpponentAfterPause(input: {
  opponentWasAudible: boolean;
  responseInProgress: boolean;
}) {
  return input.opponentWasAudible;
}
