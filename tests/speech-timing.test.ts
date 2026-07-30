import { describe, expect, it } from "vitest";
import { completedResponsePauseMs } from "../src/lib/speech-timing";

describe("speech timing", () => {
  it("records a pause only after the opponent has stopped", () => {
    expect(completedResponsePauseMs({
      opponentAudible: false,
      opponentEndedAt: 1_000,
      userStartedAt: 1_850,
    })).toBe(850);
  });

  it("never records an interruption as a response pause", () => {
    expect(completedResponsePauseMs({
      opponentAudible: true,
      opponentEndedAt: 1_000,
      userStartedAt: 21_000,
    })).toBeNull();
  });
});
