import { withRussianLanguageContract } from "@/lib/realtime-language";

type RealtimeSessionOptions = {
  instructions: string;
  negotiationStyle: "collaborative" | "hard";
  voice: "marin" | "cedar";
};

export function buildRealtimeSessionConfig({
  instructions,
  negotiationStyle,
  voice,
}: RealtimeSessionOptions) {
  return {
    type: "realtime",
    model: "gpt-realtime-2.1",
    output_modalities: ["audio"],
    reasoning: { effort: "low" },
    instructions: withRussianLanguageContract(instructions),
    audio: {
      input: {
        noise_reduction: {
          type: "far_field",
        },
        transcription: {
          model: "gpt-live-transcribe",
          languages: ["ru"],
          delay: "minimal",
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: negotiationStyle === "hard" ? "high" : "low",
          create_response: false,
          interrupt_response: false,
        },
      },
      output: { voice },
    },
  };
}
