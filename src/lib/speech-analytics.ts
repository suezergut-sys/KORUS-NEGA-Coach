import type { TranscriptTurn } from "./transcript";
import { percentile } from "./realtime-metrics";

export type SpeechAnalytics = {
  available: true;
  inputMode: "duplex";
  words: number;
  userTurns: number;
  userSpeakingMs: number;
  opponentSpeakingMs: number;
  tempoWpm: number;
  talkSharePercent: number;
  pauseCount: number;
  longPauseCount: number;
  averagePauseMs: number;
  responseTimeP50Ms: number;
  responseTimeP95Ms: number;
  questionCount: number;
  fillerCount: number;
  fillerRatePer100Words: number;
  fillers: Array<{ phrase: string; count: number }>;
  interruptionCount: number;
  pressureReaction: {
    level: "assertive" | "steady" | "hesitant";
    label: string;
    explanation: string;
  };
};

const FILLER_PHRASES = [
  "как бы",
  "в общем",
  "так сказать",
  "скажем так",
  "это самое",
  "собственно",
  "короче",
  "значит",
  "типа",
  "ну",
  "вот",
] as const;

const QUESTION_START = /^(?:кто|что|как|почему|зачем|когда|где|куда|какой|какая|какие|сколько|можете ли|правильно ли|верно ли)(?=$|[^\p{L}])/u;

function bounded(value: unknown, max = 120_000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, Math.round(parsed))) : 0;
}

function durations(value: unknown) {
  return Array.isArray(value)
    ? value.slice(0, 500).map((item) => bounded(item)).filter((item) => item > 0)
    : [];
}

function words(text: string) {
  return text.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countQuestions(turns: TranscriptTurn[]) {
  return turns.reduce((total, turn) => {
    const questionMarks = (turn.text.match(/\?/g) || []).length;
    if (questionMarks > 0) return total + questionMarks;
    return total + (QUESTION_START.test(turn.text.trim().toLocaleLowerCase("ru-RU")) ? 1 : 0);
  }, 0);
}

function countFillers(text: string) {
  return FILLER_PHRASES
    .map((phrase) => {
      const expression = new RegExp(`(^|[^\\p{L}])${escapeRegExp(phrase)}(?=$|[^\\p{L}])`, "giu");
      return { phrase, count: (text.match(expression) || []).length };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.phrase.localeCompare(right.phrase, "ru"));
}

function pressureReaction(responseP50Ms: number, fillerRate: number, interruptionCount: number) {
  if (responseP50Ms > 6_000 || fillerRate > 6) {
    const responseTiming = responseP50Ms > 0
      ? `Медианное время ответа ${formatSeconds(responseP50Ms)}`
      : "Недостаточно смен реплик для оценки времени ответа";
    return {
      level: "hesitant" as const,
      label: "Теряет темп под давлением",
      explanation: `${responseTiming}, слов-паразитов ${fillerRate} на 100 слов. Полезно выдерживать короткую осознанную паузу и начинать ответ с тезиса.`,
    };
  }
  if (interruptionCount > 0 && responseP50Ms > 0 && responseP50Ms <= 3_000) {
    return {
      level: "assertive" as const,
      label: "Активно перехватывает инициативу",
      explanation: `Ответ начинается в среднем быстро, зафиксировано перебиваний оппонента: ${interruptionCount}. Важно сохранять напор, не теряя качество слушания.`,
    };
  }
  return {
    level: "steady" as const,
    label: "Сохраняет рабочий темп",
    explanation: responseP50Ms > 0
      ? `Медианное время до ответа ${formatSeconds(responseP50Ms)}, речь остаётся достаточно собранной.`
      : "Недостаточно смен реплик для уверенной оценки реакции на давление.",
  };
}

function formatSeconds(milliseconds: number) {
  return `${(milliseconds / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
}

export function summarizeSpeechAnalytics(input: {
  inputMode?: unknown;
  turns: TranscriptTurn[];
  userSpeakingDurationsMs?: unknown;
  opponentSpeakingDurationsMs?: unknown;
  userResponseTimesMs?: unknown;
  interruptionCount?: unknown;
}): SpeechAnalytics | null {
  if (input.inputMode !== "duplex") return null;
  const userTurns = input.turns.filter((turn) => turn.author === "Вы");
  const userText = userTurns.map((turn) => turn.text).join(" ");
  const wordCount = words(userText).length;
  const userDurations = durations(input.userSpeakingDurationsMs);
  const opponentDurations = durations(input.opponentSpeakingDurationsMs);
  const responseTimes = durations(input.userResponseTimesMs);
  const userSpeakingMs = userDurations.reduce((total, value) => total + value, 0);
  const opponentSpeakingMs = opponentDurations.reduce((total, value) => total + value, 0);
  const totalSpeakingMs = userSpeakingMs + opponentSpeakingMs;
  const fillers = countFillers(userText);
  const fillerCount = fillers.reduce((total, item) => total + item.count, 0);
  const fillerRatePer100Words = wordCount ? Math.round((fillerCount / wordCount) * 1000) / 10 : 0;
  const responseTimeP50Ms = percentile(responseTimes, 50);
  const interruptionCount = bounded(input.interruptionCount, 10_000);
  return {
    available: true,
    inputMode: "duplex",
    words: wordCount,
    userTurns: userTurns.length,
    userSpeakingMs,
    opponentSpeakingMs,
    tempoWpm: userSpeakingMs ? Math.round(wordCount / (userSpeakingMs / 60_000)) : 0,
    talkSharePercent: totalSpeakingMs ? Math.round((userSpeakingMs / totalSpeakingMs) * 100) : 0,
    pauseCount: responseTimes.length,
    longPauseCount: responseTimes.filter((value) => value >= 3_000).length,
    averagePauseMs: responseTimes.length
      ? Math.round(responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length)
      : 0,
    responseTimeP50Ms,
    responseTimeP95Ms: percentile(responseTimes, 95),
    questionCount: countQuestions(userTurns),
    fillerCount,
    fillerRatePer100Words,
    fillers,
    interruptionCount,
    pressureReaction: pressureReaction(responseTimeP50Ms, fillerRatePer100Words, interruptionCount),
  };
}

export function readSpeechAnalytics(value: unknown): SpeechAnalytics | null {
  if (!value || typeof value !== "object") return null;
  const analytics = value as Partial<SpeechAnalytics>;
  if (analytics.available !== true || analytics.inputMode !== "duplex") return null;
  if (!analytics.pressureReaction || !Array.isArray(analytics.fillers)) return null;
  return analytics as SpeechAnalytics;
}
