const UTF8 = new TextEncoder();

// A UTF-8 byte is never represented by more than one embedding token. Keeping
// every item below 8,000 bytes therefore leaves headroom under the API's 8,192
// token per-input limit for every language, including Russian.
export const EMBEDDING_INPUT_MAX_BYTES = 8_000;
export const EMBEDDING_BATCH_MAX_BYTES = 240_000;
const EMBEDDING_CONTENT_MAX_BYTES = 7_600;

export type EmbeddingSection = {
  title: string;
  text: string;
};

export function utf8Bytes(value: string) {
  return UTF8.encode(value).byteLength;
}

function splitOversizedUnit(value: string, maxBytes: number) {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of value) {
    const characterBytes = utf8Bytes(character);
    if (current && currentBytes + characterBytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += characterBytes;
  }

  if (current) chunks.push(current);
  return chunks;
}

/** Splits at line boundaries where possible and preserves the complete text. */
export function splitEmbeddingText(value: string, maxBytes = EMBEDDING_CONTENT_MAX_BYTES) {
  if (!value) return [];
  if (utf8Bytes(value) <= maxBytes) return [value];

  const units = value.match(/[^\n]*\n|[^\n]+$/g) || [value];
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const unit of units) {
    const unitBytes = utf8Bytes(unit);
    if (unitBytes > maxBytes) {
      if (current) {
        chunks.push(current);
        current = "";
        currentBytes = 0;
      }
      chunks.push(...splitOversizedUnit(unit, maxBytes));
      continue;
    }
    if (current && currentBytes + unitBytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += unit;
    currentBytes += unitBytes;
  }

  if (current) chunks.push(current);
  return chunks;
}

export function buildEmbeddingInputs(sections: EmbeddingSection[]) {
  return sections.flatMap((section) => {
    if (!section.text.trim()) return [];
    const parts = splitEmbeddingText(section.text);
    return parts.map((part, index) => {
      const suffix = parts.length > 1 ? ` — часть ${index + 1}/${parts.length}` : "";
      const result = `${section.title}${suffix}:\n${part}`;
      if (utf8Bytes(result) > EMBEDDING_INPUT_MAX_BYTES) {
        throw new Error("Внутренняя ошибка разбиения текста для embeddings.");
      }
      return result;
    });
  });
}

export function batchEmbeddingInputs(inputs: string[]) {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;

  for (const input of inputs) {
    const inputBytes = utf8Bytes(input);
    if (inputBytes > EMBEDDING_INPUT_MAX_BYTES) {
      throw new Error("Embedding-вход превышает безопасный размер.");
    }
    if (current.length && currentBytes + inputBytes > EMBEDDING_BATCH_MAX_BYTES) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(input);
    currentBytes += inputBytes;
  }

  if (current.length) batches.push(current);
  return batches;
}
