import "server-only";

import { batchEmbeddingInputs } from "@/lib/embedding-input";

type EmbeddingClient = {
  embeddings: {
    create: (input: {
      model: string;
      input: string[];
      encoding_format: "float";
    }) => Promise<{ data: Array<{ index: number; embedding: number[] }> }>;
  };
};

export async function createEmbeddingVectors(client: EmbeddingClient, model: string, inputs: string[]) {
  const vectors: number[][] = [];

  for (const batch of batchEmbeddingInputs(inputs)) {
    const response = await client.embeddings.create({
      model,
      input: batch,
      encoding_format: "float",
    });
    vectors.push(...response.data
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding));
  }

  if (vectors.length !== inputs.length) {
    throw new Error("Сервис embeddings вернул неполный пакет результатов.");
  }
  return vectors;
}
