export type NegotiationInputMode = "duplex" | "duplex_live" | "push_to_talk" | "text_only";

export const DEFAULT_NEGOTIATION_INPUT_MODE: NegotiationInputMode = "text_only";

export function initialNegotiationInputMode(voiceEvalMode = false): NegotiationInputMode {
  return voiceEvalMode ? "duplex" : DEFAULT_NEGOTIATION_INPUT_MODE;
}

export const NEGOTIATION_INPUT_MODE_OPTIONS = [
  {
    mode: "text_only",
    label: "Только текст",
    infoLabel: "Описание режима Только текст",
    description: "Оппонент общается без озвучки, только текстом. Отвечать можно текстом или через микрофон.",
  },
  {
    mode: "push_to_talk",
    label: "Обычный",
    infoLabel: "Описание обычного режима",
    description: "Микрофон передаёт звук только пока вы удерживаете кнопку. Подходит для шумных помещений и турниров с комментариями ведущего.",
  },
  {
    mode: "duplex",
    label: "Дуплекс",
    infoLabel: "Описание режима Дуплекс",
    description: "Микрофон работает постоянно: можно говорить одновременно с оппонентом и перебивать его.",
  },
  {
    mode: "duplex_live",
    label: "Дуплекс Live",
    infoLabel: "Описание режима Дуплекс Live",
    description: "Экспериментальный живой диалог: оппонент слушает одновременно с речью, а сложные решения обдумывает отдельно. Сравните с режимом Дуплекс.",
  },
] as const satisfies ReadonlyArray<{
  mode: NegotiationInputMode;
  label: string;
  infoLabel: string;
  description: string;
}>;

export function shouldEnableMicrophone(mode: NegotiationInputMode, paused: boolean, pushToTalkActive: boolean) {
  if (paused) return false;
  return mode === "duplex" || mode === "duplex_live" || (mode === "push_to_talk" && pushToTalkActive);
}
