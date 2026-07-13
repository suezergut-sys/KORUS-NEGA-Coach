type MutableValue<T> = { current: T };

type NegotiationClockRefs = {
  elapsedActiveMs: MutableValue<number>;
  activeRunStartedAt: MutableValue<number | null>;
  pauseEndsAt: MutableValue<number | null>;
};

export function resetNegotiationClock(
  refs: NegotiationClockRefs,
  setElapsedSeconds: (seconds: number) => void,
) {
  refs.elapsedActiveMs.current = 0;
  refs.activeRunStartedAt.current = null;
  refs.pauseEndsAt.current = null;
  setElapsedSeconds(0);
}
