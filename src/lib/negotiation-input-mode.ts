export type NegotiationInputMode = "duplex" | "push_to_talk" | "text_only";

export function shouldEnableMicrophone(mode: NegotiationInputMode, paused: boolean, pushToTalkActive: boolean) {
  if (paused) return false;
  return mode === "duplex" || (mode === "push_to_talk" && pushToTalkActive);
}
