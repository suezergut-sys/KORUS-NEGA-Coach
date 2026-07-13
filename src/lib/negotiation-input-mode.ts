export type NegotiationInputMode = "duplex" | "push_to_talk";

export function shouldEnableMicrophone(mode: NegotiationInputMode, paused: boolean, pushToTalkActive: boolean) {
  if (paused) return false;
  return mode === "duplex" || pushToTalkActive;
}
