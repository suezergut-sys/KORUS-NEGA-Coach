import { percentile } from "./realtime-metrics";

export function sanitizeLiveComparison(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const samples = Array.isArray(input.backendDurationsMs)
    ? input.backendDurationsMs.slice(0, 500).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 120_000).map(Math.round) : [];
  return {
    voiceModel: "gpt-live-1",
    latencySource: "browser_audio_energy",
    backendDurationsMs: samples,
    backendP50Ms: percentile(samples, 50),
    backendP95Ms: percentile(samples, 95),
    delegationCount: typeof input.delegationCount === "number" && Number.isFinite(input.delegationCount) ? Math.max(0, Math.min(10_000, Math.floor(input.delegationCount))) : 0,
  };
}
