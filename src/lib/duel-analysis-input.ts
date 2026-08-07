const UTF8 = new TextEncoder();

export const DUEL_EMBEDDING_INPUT_MAX_BYTES = 8_000;

function utf8Bytes(value: string) {
  return UTF8.encode(value).byteLength;
}

function takeUtf8(value: string, maxBytes: number, fromEnd = false) {
  if (maxBytes <= 0) return "";
  const characters = Array.from(value);
  const selected: string[] = [];
  let usedBytes = 0;
  const start = fromEnd ? characters.length - 1 : 0;
  const end = fromEnd ? -1 : characters.length;
  const step = fromEnd ? -1 : 1;

  for (let index = start; index !== end; index += step) {
    const character = characters[index];
    const characterBytes = utf8Bytes(character);
    if (usedBytes + characterBytes > maxBytes) break;
    selected.push(character);
    usedBytes += characterBytes;
  }

  if (fromEnd) selected.reverse();
  return selected.join("");
}

export function excerptUtf8(value: string, maxBytes: number) {
  if (utf8Bytes(value) <= maxBytes) return value;
  const marker = "\n…[фрагмент сокращён]…\n";
  const markerBytes = utf8Bytes(marker);
  if (markerBytes >= maxBytes) return takeUtf8(value, maxBytes);
  const contentBytes = maxBytes - markerBytes;
  const headBytes = Math.ceil(contentBytes * 0.6);
  return `${takeUtf8(value, headBytes)}${marker}${takeUtf8(value, contentBytes - headBytes, true)}`;
}

export function buildDuelEmbeddingInput(caseText: string, transcriptText: string) {
  const casePrefix = "КЕЙС:\n";
  const transcriptPrefix = "\n\nРАСШИФРОВКА:\n";
  const fixedBytes = utf8Bytes(casePrefix) + utf8Bytes(transcriptPrefix);
  const contentBudget = DUEL_EMBEDDING_INPUT_MAX_BYTES - fixedBytes;
  const caseBytes = utf8Bytes(caseText);
  const transcriptBytes = utf8Bytes(transcriptText);

  let caseBudget = Math.min(caseBytes, Math.floor(contentBudget * 0.4));
  let transcriptBudget = Math.min(transcriptBytes, contentBudget - caseBudget);
  let remaining = contentBudget - caseBudget - transcriptBudget;

  const extraCaseBytes = Math.min(remaining, caseBytes - caseBudget);
  caseBudget += extraCaseBytes;
  remaining -= extraCaseBytes;
  transcriptBudget += Math.min(remaining, transcriptBytes - transcriptBudget);

  return `${casePrefix}${excerptUtf8(caseText, caseBudget)}${transcriptPrefix}${excerptUtf8(transcriptText, transcriptBudget)}`;
}
