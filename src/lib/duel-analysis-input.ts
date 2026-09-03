import { buildEmbeddingInputs, EMBEDDING_INPUT_MAX_BYTES } from "@/lib/embedding-input";

export const DUEL_EMBEDDING_INPUT_MAX_BYTES = EMBEDDING_INPUT_MAX_BYTES;

export function buildDuelEmbeddingInputs(caseText: string, transcriptText: string) {
  return buildEmbeddingInputs([
    { title: "КЕЙС", text: caseText },
    { title: "РАСШИФРОВКА", text: transcriptText },
  ]);
}
