import { describe, expect, it } from "vitest";
import { LiveCaptions, liveInstructions } from "../src/lib/live-conversation";
import { buildLiveSessionConfig } from "../src/lib/live-session";
import { sanitizeLiveComparison } from "../src/lib/live-metrics";
import { DEFAULT_CASE } from "../src/lib/default-case";

describe("Live captions and negotiation configuration", () => {
  it("preserves concurrent speakers, repeated words and exact spaces without duplicate delivery", () => {
    const captions = new LiveCaptions();
    const delta = (speaker: string, text: string, start: number, end: number, id: string) => captions.append({ type: `session.${speaker}_transcript.delta`, delta: text, start_ms: start, end_ms: end, event_id: id });
    delta("output", "Я считаю", 0, 600, "a");
    delta("input", "Нет, нет", 400, 650, "b");
    delta("output", ", что", 600, 800, "c");
    delta("input", ", послушайте.", 650, 950, "d");
    delta("input", ", послушайте.", 650, 950, "d");
    delta("output", " Слушаю.", 1200, 1600, "e");
    expect(captions.rows.map((r) => r.text)).toEqual(["Я считаю, что", "Нет, нет, послушайте.", " Слушаю."]);
    expect(captions.rows.map((r) => r.id)).toEqual(["live-0", "live-1", "live-2"]);
    expect(captions.append({ type: "session.input_transcript.delta", delta: "bad", start_ms: -1, end_ms: 1 })).toBeNull();
  });

  it("separates voice and substantive case decisions and preserves the participant-first contract", () => {
    const config = buildLiveSessionConfig({ instructions: "Полный секретный сценарий и условия уступок", negotiationCase: DEFAULT_CASE, participantRole: DEFAULT_CASE.userRole, opponentRole: DEFAULT_CASE.opponentRole, negotiationStyle: "hard", firstSpeaker: "participant", voice: "cedar" });
    expect(config.model).toBe("gpt-live-1");
    expect(config.instructions).toContain("Первым начинает пользователь");
    expect(config.instructions).toContain("До результата backend не объявляй уступку");
    expect(config.instructions).not.toContain("Полный секретный сценарий");
    expect(config.delegation.responses.instructions).toContain("Полный секретный сценарий");
    expect(config.delegation.responses.model).toBe("gpt-5.4-mini");
    expect(config.delegation.responses.reasoning.effort).toBe("low");
    expect(config).not.toHaveProperty("turn_detection");
    expect(liveInstructions("Продолжай")).toMatchObject({ type: "session.instructions.append", delegation_id: null, content: "Продолжай" });
  });

  it("bounds stored comparison data and never treats client model names as authoritative", () => {
    expect(sanitizeLiveComparison({ voiceModel: "fake", backendDurationsMs: [100, -1, Infinity, "secret", 999999], delegationCount: Infinity })).toEqual({ voiceModel: "gpt-live-1", latencySource: "browser_audio_energy", backendDurationsMs: [100], backendP50Ms: 100, backendP95Ms: 100, delegationCount: 0 });
  });
});
