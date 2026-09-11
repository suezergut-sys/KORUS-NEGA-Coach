import { describe, expect, it } from "vitest";
import { LiveCaptions } from "../src/lib/live-conversation";
import { liveSpeechTiming } from "../src/lib/live-speech-timing";

describe("Live speech timing", () => {
  it("measures overlapping captions, ignores duplicate delivery and excludes application pauses", () => {
    const captions = new LiveCaptions();
    const append = (speaker: string, text: string, start: number, end: number, id: string) => captions.append({ type: `session.${speaker}_transcript.delta`, delta: text, start_ms: start, end_ms: end, event_id: id });
    append("output", "Обсудим условия", 0, 4000, "1");
    append("input", "Ну, слушаю", 3000, 5000, "2");
    append("input", "Ну, слушаю", 3000, 5000, "2");
    append("output", "Есть предложение", 6000, 9000, "3");
    append("input", "Какие условия?", 12000, 14000, "4");
    append("output", "Продолжим", 15000, 18000, "5");
    captions.breakTurn();
    append("input", "После паузы", 60000, 62000, "6");
    expect(liveSpeechTiming(captions)).toEqual({ opponentTimingSource: "live_transcript", userSpeakingDurationsMs: [2000, 2000, 2000], opponentSpeakingDurationsMs: [4000, 3000, 3000], userResponseTimesMs: [3000], interruptionCount: 1 });
  });
  it("starts a new caption after a pause even when the speaker has not changed", () => {
    const captions = new LiveCaptions();
    captions.append({ type: "session.input_transcript.delta", delta: "До паузы", start_ms: 0, end_ms: 1000 });
    captions.breakTurn();
    captions.append({ type: "session.input_transcript.delta", delta: "После паузы", start_ms: 1100, end_ms: 2000 });
    expect(captions.rows).toHaveLength(2);
    expect(liveSpeechTiming(captions).userSpeakingDurationsMs).toEqual([1000, 900]);
  });
});
