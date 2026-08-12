export function completePendingSpeechItem(
  pendingItemIds: ReadonlySet<string>,
  completedItemId: string,
) {
  const remainingItemIds = new Set(pendingItemIds);
  remainingItemIds.delete(completedItemId);
  return {
    remainingItemIds,
    shouldWaitForSiblingTranscript: remainingItemIds.size > 0,
  };
}

export function shouldReplaceActiveResponseForLateTranscript(input: {
  hasInterruptionCandidate: boolean;
  responseInProgress: boolean;
  opponentAudible: boolean;
  waitingForSiblingTranscript: boolean;
}) {
  return !input.hasInterruptionCandidate
    && !input.waitingForSiblingTranscript
    && (input.responseInProgress || input.opponentAudible);
}
