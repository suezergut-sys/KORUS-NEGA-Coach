export function completedResponsePauseMs(input: {
  opponentAudible: boolean;
  opponentEndedAt: number;
  userStartedAt: number;
}) {
  if (input.opponentAudible || input.opponentEndedAt <= 0) return null;
  return Math.max(1, input.userStartedAt - input.opponentEndedAt);
}
