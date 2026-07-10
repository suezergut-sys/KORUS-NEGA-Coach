import "server-only";

import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY не настроен.");
  }

  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.4-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";

