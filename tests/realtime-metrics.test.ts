import { describe, expect, it } from "vitest";
import { percentile, summarizeRealtimeMetrics } from "../src/lib/realtime-metrics";

describe("realtime metrics", () => {
  it("calculates nearest-rank percentiles", () => {
    expect(percentile([900, 100, 500, 300], 50)).toBe(300);
    expect(percentile([900, 100, 500, 300], 95)).toBe(900);
  });

  it("normalizes untrusted client measurements", () => {
    const result = summarizeRealtimeMetrics({
      setupLatencyMs: 140_000,
      replyLatenciesMs: [-5, 100.2, "400", Number.NaN],
      recoveryCount: 2.4,
      interruptionCount: -1,
      connectionErrorCount: 99_999,
    });
    expect(result).toMatchObject({
      setupLatencyMs: 120_000,
      replyLatencyP50Ms: 100,
      replyLatencyP95Ms: 400,
      replyLatencySamples: 2,
      recoveryCount: 2,
      interruptionCount: 0,
      connectionErrorCount: 10_000,
    });
  });
});
