export const PLATFORM_TEST_DURATIONS = [1, 3, 5, 10] as const;

export type PlatformTestDuration = typeof PLATFORM_TEST_DURATIONS[number];
export type PlatformTestSpeaker = "human" | "opponent";
export type PlatformTestSeverity = "critical" | "warning" | "info";

export type PlatformTestCaseOption = {
  id: string;
  title: string;
  participantName: string;
  participantPosition: string;
  opponentName: string;
  opponentPosition: string;
  opponentVoiceGender: "female" | "male";
};

export type PlatformTestTurn = {
  id: string;
  speaker: PlatformTestSpeaker;
  text: string;
  atMs: number;
  recognizedText?: string;
};

export type PlatformTestTraceEvent = {
  atMs: number;
  type: string;
  details?: Record<string, string | number | boolean | null>;
};

export type PlatformTestAnomaly = {
  id: string;
  severity: PlatformTestSeverity;
  category: "connection" | "transcription" | "latency" | "grounding" | "role" | "dialogue" | "reporting";
  title: string;
  details: string;
  evidence?: string;
};

export type PlatformTestMetrics = {
  durationSeconds: number;
  humanTurns: number;
  opponentTurns: number;
  averageResponseLatencyMs: number | null;
  maximumResponseLatencyMs: number | null;
  realtimeErrors: number;
};

export type PlatformTestReport = {
  passed: boolean;
  summary: string;
  metrics: PlatformTestMetrics;
  anomalies: PlatformTestAnomaly[];
};

export function parsePlatformTestDuration(value: unknown): PlatformTestDuration {
  const parsed = Number(value);
  return PLATFORM_TEST_DURATIONS.includes(parsed as PlatformTestDuration)
    ? parsed as PlatformTestDuration
    : 1;
}

function normalizedWords(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function transcriptSimilarity(expected: string, actual: string) {
  const expectedWords = new Set(normalizedWords(expected));
  const actualWords = new Set(normalizedWords(actual));
  if (!expectedWords.size || !actualWords.size) return 0;
  const intersection = [...expectedWords].filter((word) => actualWords.has(word)).length;
  return intersection / Math.max(expectedWords.size, actualWords.size);
}

export function buildDeterministicPlatformTestReport(input: {
  durationSeconds: number;
  turns: readonly PlatformTestTurn[];
  events: readonly PlatformTestTraceEvent[];
}) {
  const anomalies: PlatformTestAnomaly[] = [];
  const humanTurns = input.turns.filter((turn) => turn.speaker === "human");
  const opponentTurns = input.turns.filter((turn) => turn.speaker === "opponent");
  const realtimeErrors = input.events.filter((event) => event.type === "error" || event.type === "connection_failed");
  const latencies = input.events
    .filter((event) => event.type === "response_latency")
    .map((event) => Number(event.details?.latencyMs))
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (!opponentTurns.length) {
    anomalies.push({
      id: "no-opponent-turns",
      severity: "critical",
      category: "dialogue",
      title: "Оппонент не произнёс ни одной реплики",
      details: "Realtime-сессия не дала проверяемого ответа оппонента.",
    });
  }
  if (!humanTurns.length) {
    anomalies.push({
      id: "no-human-turns",
      severity: "critical",
      category: "dialogue",
      title: "AI-участник не произнёс ни одной реплики",
      details: "Генерация или подача речи в виртуальный микрофон не состоялась.",
    });
  }

  for (const [index, turn] of humanTurns.entries()) {
    if (!turn.recognizedText) {
      anomalies.push({
        id: `missing-transcription-${index}`,
        severity: "warning",
        category: "transcription",
        title: "Нет расшифровки реплики AI-участника",
        details: "Синтезированная реплика была подана в аудиоканал, но Realtime не вернул завершённую расшифровку.",
        evidence: turn.text,
      });
      continue;
    }
    if (transcriptSimilarity(turn.text, turn.recognizedText) < 0.45) {
      anomalies.push({
        id: `transcription-mismatch-${index}`,
        severity: "warning",
        category: "transcription",
        title: "Расшифровка заметно отличается от произнесённой реплики",
        details: `Ожидалось: «${turn.text}». Распознано: «${turn.recognizedText}».`,
      });
    }
  }

  for (const [index, latency] of latencies.entries()) {
    if (latency <= 8_000) continue;
    anomalies.push({
      id: `slow-response-${index}`,
      severity: latency > 15_000 ? "critical" : "warning",
      category: "latency",
      title: "Медленный запуск ответа оппонента",
      details: `После расшифровки реплики ответ создавался ${(latency / 1_000).toFixed(1)} сек.`,
    });
  }

  for (const [index, event] of realtimeErrors.entries()) {
    anomalies.push({
      id: `realtime-error-${index}`,
      severity: "critical",
      category: "connection",
      title: "Ошибка Realtime-сессии",
      details: String(event.details?.message || event.details?.state || "Realtime вернул ошибку без описания."),
    });
  }

  for (let index = 1; index < opponentTurns.length; index += 1) {
    const previous = opponentTurns[index - 1].text.trim().toLocaleLowerCase("ru-RU");
    const current = opponentTurns[index].text.trim().toLocaleLowerCase("ru-RU");
    if (previous.length >= 20 && previous === current) {
      anomalies.push({
        id: `duplicate-opponent-turn-${index}`,
        severity: "warning",
        category: "dialogue",
        title: "Оппонент дословно повторил предыдущую реплику",
        details: "Две последовательные реплики оппонента полностью совпадают.",
        evidence: opponentTurns[index].text,
      });
    }
  }

  return {
    anomalies,
    metrics: {
      durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
      humanTurns: humanTurns.length,
      opponentTurns: opponentTurns.length,
      averageResponseLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      maximumResponseLatencyMs: latencies.length ? Math.round(Math.max(...latencies)) : null,
      realtimeErrors: realtimeErrors.length,
    } satisfies PlatformTestMetrics,
  };
}
