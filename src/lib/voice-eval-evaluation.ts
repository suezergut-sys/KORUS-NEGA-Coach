import type { VoiceEvalRecord } from "@/lib/voice-eval";

export type VoiceEvalTraceRule = {
  source: VoiceEvalRecord["source"];
  name: string;
  minCount?: number;
  maxCount?: number;
};

export type VoiceEvalTraceExpectation = {
  rules: VoiceEvalTraceRule[];
  maxBargeInStopLatencyMs?: number;
};

export function countVoiceEvalRecords(
  records: readonly VoiceEvalRecord[],
  source: VoiceEvalRecord["source"],
  name: string,
) {
  return records.filter((record) => record.source === source && record.name === name).length;
}

export function evaluateVoiceEvalTrace(
  records: readonly VoiceEvalRecord[],
  expectation: VoiceEvalTraceExpectation,
) {
  const failures: string[] = [];
  for (const rule of expectation.rules) {
    const count = countVoiceEvalRecords(records, rule.source, rule.name);
    if (rule.minCount !== undefined && count < rule.minCount) {
      failures.push(`${rule.source}:${rule.name}: ожидалось не менее ${rule.minCount}, получено ${count}`);
    }
    if (rule.maxCount !== undefined && count > rule.maxCount) {
      failures.push(`${rule.source}:${rule.name}: ожидалось не более ${rule.maxCount}, получено ${count}`);
    }
  }

  if (expectation.maxBargeInStopLatencyMs !== undefined) {
    const latencies = records
      .filter((record) => record.source === "diagnostic" && record.name === "barge_in_stop_confirmed")
      .map((record) => record.details.latencyMs)
      .filter((value): value is number => typeof value === "number");
    if (latencies.length === 0) {
      failures.push("не зафиксировано подтверждение остановки голоса после перебивания");
    } else if (latencies.some((latency) => latency > expectation.maxBargeInStopLatencyMs!)) {
      failures.push(`остановка голоса заняла ${Math.max(...latencies)} мс при лимите ${expectation.maxBargeInStopLatencyMs} мс`);
    }
  }

  return { passed: failures.length === 0, failures };
}

const CRITICAL_NUMBER = /\b(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(%|процент(?:а|ов)?|руб(?:ля|лей|ль)?|(?:рабоч(?:ий|их)\s+)?д(?:ень|ня|ней)|час(?:а|ов)?|недел(?:я|и|ь)|месяц(?:а|ев)?|год(?:а|ов)?)?/giu;

function normalizedFacts(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

export function findUnsupportedCriticalFacts(output: string, evidence: string) {
  const canonicalUnit = (unit: string) => {
    const normalized = normalizedFacts(unit).replace(/^рабоч(?:ий|их)\s+/u, "");
    if (!normalized) return "number";
    if (normalized === "%" || normalized.startsWith("процент")) return "percent";
    if (normalized.startsWith("руб")) return "currency";
    if (normalized.startsWith("д")) return "day";
    if (normalized.startsWith("час")) return "hour";
    if (normalized.startsWith("недел")) return "week";
    if (normalized.startsWith("месяц")) return "month";
    if (normalized.startsWith("год")) return "year";
    return normalized;
  };
  const extract = (text: string) => [...text.matchAll(CRITICAL_NUMBER)].map((match) => {
    const numbers = [match[1], match[2]].filter(Boolean).map((number) => number.replace(",", "."));
    const unit = canonicalUnit(match[3] || "");
    return {
      display: match[0].trim(),
      keys: numbers.map((number) => `${number}:${unit}`),
    };
  });
  const evidenceKeys = new Set(extract(evidence).flatMap((fact) => fact.keys));
  const unsupported = extract(output)
    .filter((fact) => fact.keys.some((key) => !evidenceKeys.has(key)))
    .map((fact) => fact.display);
  return [...new Set(unsupported)];
}
