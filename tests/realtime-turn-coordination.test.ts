import { describe, expect, it } from "vitest";
import {
  completePendingSpeechItem,
  shouldReplaceActiveResponseForLateTranscript,
} from "../src/lib/realtime-turn-coordination";

describe("realtime turn coordination", () => {
  it("waits until every VAD item from one continuous user turn is transcribed", () => {
    const first = completePendingSpeechItem(new Set(["user-1", "user-2"]), "user-1");
    expect(first.shouldWaitForSiblingTranscript).toBe(true);
    expect([...first.remainingItemIds]).toEqual(["user-2"]);

    const second = completePendingSpeechItem(first.remainingItemIds, "user-2");
    expect(second.shouldWaitForSiblingTranscript).toBe(false);
    expect(second.remainingItemIds.size).toBe(0);
  });

  it("replaces a premature response when a late transcript arrives without a new barge-in", () => {
    expect(shouldReplaceActiveResponseForLateTranscript({
      hasInterruptionCandidate: false,
      responseInProgress: true,
      opponentAudible: true,
      waitingForSiblingTranscript: false,
    })).toBe(true);
  });

  it("does not replace a response while another known user transcript is still pending", () => {
    expect(shouldReplaceActiveResponseForLateTranscript({
      hasInterruptionCandidate: false,
      responseInProgress: true,
      opponentAudible: true,
      waitingForSiblingTranscript: true,
    })).toBe(false);
  });
});
