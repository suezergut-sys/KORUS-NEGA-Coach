import type { VoiceEvalTraceExpectation } from "@/lib/voice-eval-evaluation";

export type VoiceEvalScenario = {
  id: string;
  title: string;
  userPhrases: string[];
  trace: VoiceEvalTraceExpectation;
  semanticGrounding: boolean;
};

export const VOICE_EVAL_SCENARIOS = {
  normalDialogue: {
    id: "normal-dialogue",
    title: "Обычная законченная реплика",
    userPhrases: ["Ну, давайте, давайте спокойно определим причины срыва и, ну, согласуем реалистичный план восстановления."],
    trace: {
      rules: [
        { source: "realtime", name: "conversation.item.input_audio_transcription.completed", minCount: 1 },
        { source: "realtime", name: "response.done", minCount: 2 },
        { source: "diagnostic", name: "interruption_confirmed", maxCount: 0 },
      ],
    },
    semanticGrounding: true,
  },
  singleInterruption: {
    id: "single-interruption",
    title: "Одно перебивание оппонента",
    userPhrases: ["Стоп, дайте мне уточнить: какие ресурсы вам нужны для исправления ситуации?"],
    trace: {
      rules: [
        { source: "diagnostic", name: "interruption_confirmed", minCount: 1, maxCount: 1 },
        { source: "diagnostic", name: "barge_in_sent", minCount: 1 },
        { source: "diagnostic", name: "emotion_shift", minCount: 1 },
      ],
      maxBargeInStopLatencyMs: 500,
    },
    semanticGrounding: true,
  },
  repeatedInterruption: {
    id: "repeated-interruption",
    title: "Повторное перебивание",
    userPhrases: [
      "Стоп, сначала назовите конкретную причину срыва.",
      "Подождите, не уходите от ответа: какой ресурс вам действительно необходим?",
    ],
    trace: {
      rules: [
        { source: "diagnostic", name: "interruption_confirmed", minCount: 2, maxCount: 2 },
        { source: "diagnostic", name: "emotion_shift", minCount: 2 },
      ],
      maxBargeInStopLatencyMs: 500,
    },
    semanticGrounding: true,
  },
  longPause: {
    id: "long-pause",
    title: "Незавершённая реплика с длинной паузой",
    userPhrases: ["Я", "предлагаю выделить дополнительного аналитика и уложиться в десять рабочих дней."],
    trace: {
      rules: [
        { source: "realtime", name: "conversation.item.input_audio_transcription.completed", minCount: 1 },
        { source: "diagnostic", name: "turn_gate_clarification", maxCount: 0 },
      ],
    },
    semanticGrounding: true,
  },
  backgroundNoise: {
    id: "background-noise",
    title: "Посторонний шум во время ответа",
    userPhrases: [],
    trace: {
      rules: [
        { source: "diagnostic", name: "interruption_confirmed", maxCount: 0 },
        { source: "diagnostic", name: "emotion_shift", maxCount: 0 },
      ],
    },
    semanticGrounding: false,
  },
  hallucinationTrap: {
    id: "hallucination-trap",
    title: "Неопределённая реплика без новых фактов",
    userPhrases: ["Я предлагаю сделать это так, чтобы ситуация больше не повторилась."],
    trace: {
      rules: [
        { source: "realtime", name: "response.done", minCount: 2 },
      ],
    },
    semanticGrounding: true,
  },
} satisfies Record<string, VoiceEvalScenario>;
