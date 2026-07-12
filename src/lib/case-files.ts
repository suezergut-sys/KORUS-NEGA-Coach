import "server-only";

import mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 6;

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "rtf", "log"]);
const ALLOWED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, "pdf", "docx"]);

function extension(name: string) {
  return name.toLocaleLowerCase().split(".").pop() || "";
}

export function safeFileName(name: string) {
  const ext = extension(name).replace(/[^a-z0-9]/g, "").slice(0, 12) || "bin";
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80) || "material";
  return `${base}.${ext}`;
}

function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractUploadedFile(file: File) {
  const ext = extension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Формат .${ext || "без расширения"} не поддерживается. Используйте TXT, MD, CSV, JSON, XML, HTML, RTF, PDF или DOCX.`);
  }
  if (!file.size || file.size > MAX_FILE_BYTES) {
    throw new Error(`Файл «${file.name}» должен быть меньше 3 МБ.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let text = "";
  if (TEXT_EXTENSIONS.has(ext)) {
    text = bytes.toString("utf8");
  } else if (ext === "docx") {
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else if (ext === "pdf") {
    text = (await extractPdfText(new Uint8Array(bytes), { mergePages: true })).text;
  }

  text = normalizeText(text).slice(0, 50000);
  if (text.length < 40) throw new Error(`В файле «${file.name}» не удалось найти достаточно текста.`);
  return { bytes, text, safeName: safeFileName(file.name), mimeType: file.type || "application/octet-stream" };
}

export function validateFiles(files: File[]) {
  if (!files.length) return;
  if (files.length > MAX_FILES) throw new Error(`Можно загрузить не более ${MAX_FILES} файлов за один анализ.`);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error("Общий размер файлов должен быть меньше 4 МБ.");
}
