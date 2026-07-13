import { describe, expect, it, vi } from "vitest";
import { resetNegotiationClock } from "../src/lib/negotiation-timer";

describe("сброс таймера переговоров", () => {
  it("удаляет накопленное время и возвращает отображение к началу", () => {
    const refs = {
      elapsedActiveMs: { current: 184_000 },
      activeRunStartedAt: { current: Date.now() - 9_000 },
      pauseEndsAt: { current: Date.now() + 30_000 },
    };
    const setElapsedSeconds = vi.fn();

    resetNegotiationClock(refs, setElapsedSeconds);

    expect(refs).toEqual({
      elapsedActiveMs: { current: 0 },
      activeRunStartedAt: { current: null },
      pauseEndsAt: { current: null },
    });
    expect(setElapsedSeconds).toHaveBeenCalledWith(0);
  });
});
