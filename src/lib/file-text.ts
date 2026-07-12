const BIDI_AND_CONTROL = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function decoder(label: string, fatal = false) {
  return new TextDecoder(label, { fatal });
}

function declaredEncoding(bytes: Uint8Array) {
  const head = decoder("windows-1252").decode(bytes.slice(0, 2048));
  const xml = head.match(/<\?xml[^>]*encoding\s*=\s*["']\s*([^"']+)/i)?.[1];
  const html = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([^\s"'/>]+)/i)?.[1]
    || head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^\s;"']+)/i)?.[1];
  return (xml || html || "").trim().toLowerCase();
}

function normalizeEncoding(label: string) {
  if (/^(utf-?8)$/.test(label)) return "utf-8";
  if (/^(windows-1251|cp1251|win-1251)$/.test(label)) return "windows-1251";
  if (/^(utf-?16le)$/.test(label)) return "utf-16le";
  if (/^(utf-?16be)$/.test(label)) return "utf-16be";
  return "";
}

function validateDecodedText(value: string) {
  const replacementCount = value.split("\uFFFD").length - 1;
  const suspiciousControls = [...value].filter((char) => {
    const code = char.charCodeAt(0);
    return (code < 32 && !"\n\r\t".includes(char)) || (code >= 127 && code <= 159);
  }).length;
  if (replacementCount || suspiciousControls > Math.max(2, value.length * 0.005)) {
    throw new Error("Текст содержит признаки неверной кодировки или бинарные данные.");
  }
  return value.normalize("NFC");
}

export function decodeTextBytes(input: Uint8Array) {
  let bytes = input;
  let encoding = "";
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.slice(3);
    encoding = "utf-8";
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    bytes = bytes.slice(2);
    encoding = "utf-16le";
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    bytes = bytes.slice(2);
    encoding = "utf-16be";
  } else {
    const declared = declaredEncoding(bytes);
    encoding = normalizeEncoding(declared);
    if (declared && !encoding) throw new Error(`Кодировка «${declared}» не поддерживается. Сохраните файл в UTF-8 или Windows-1251.`);
  }

  if (encoding) return validateDecodedText(decoder(encoding, encoding === "utf-8").decode(bytes));
  try {
    return validateDecodedText(decoder("utf-8", true).decode(bytes));
  } catch {
    return validateDecodedText(decoder("windows-1251").decode(bytes));
  }
}

export function decodeRtfEscapes(value: string) {
  const cp1251 = decoder("windows-1251");
  return value.replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => cp1251.decode(Uint8Array.of(Number.parseInt(hex, 16))));
}

export function displayFileName(name: string) {
  const normalized = name.normalize("NFC").replace(BIDI_AND_CONTROL, "").replace(/[\\/]/g, "-").trim();
  return normalized.slice(0, 240) || "material";
}

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function asciiStorageBase(name: string) {
  return [...displayFileName(name).toLowerCase()]
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80) || "material";
}
