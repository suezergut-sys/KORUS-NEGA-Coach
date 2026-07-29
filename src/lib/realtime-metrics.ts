export type RealtimeMetricSummary = {
  setupLatencyMs: number;
  replyLatencyP50Ms: number;
  replyLatencyP95Ms: number;
  replyLatencySamples: number;
  recoveryCount: number;
  interruptionCount: number;
  connectionErrorCount: number;
  replyLatenciesMs: number[];
};

function bounded(value: unknown, max = 120_000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, Math.round(parsed))) : 0;
}

export function percentile(values: number[], percentileValue: number) {
  const sorted = values.map((value) => bounded(value)).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.ceil((Math.min(100, Math.max(0, percentileValue)) / 100) * sorted.length) - 1);
  return sorted[index];
}

export function summarizeRealtimeMetrics(input: {
  setupLatencyMs?: unknown;
  replyLatenciesMs?: unknown;
  recoveryCount?: unknown;
  interruptionCount?: unknown;
  connectionErrorCount?: unknown;
}): RealtimeMetricSummary {
  const latencies = Array.isArray(input.replyLatenciesMs)
    ? input.replyLatenciesMs.slice(0, 500).map((value) => bounded(value)).filter((value) => value > 0)
    : [];
  return {
    setupLatencyMs: bounded(input.setupLatencyMs),
    replyLatencyP50Ms: percentile(latencies, 50),
    replyLatencyP95Ms: percentile(latencies, 95),
    replyLatencySamples: latencies.length,
    recoveryCount: bounded(input.recoveryCount, 10_000),
    interruptionCount: bounded(input.interruptionCount, 10_000),
    connectionErrorCount: bounded(input.connectionErrorCount, 10_000),
    replyLatenciesMs: latencies,
  };
}
