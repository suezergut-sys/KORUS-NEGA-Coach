import "server-only";

import mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";
import { asciiStorageBase, decodeRtfEscapes, decodeTextBytes, displayFileName } from "@/lib/file-text";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 6;

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "rtf", "log"]);
const ALLOWED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, "pdf", "docx"]);

function extension(name: string) {
  return displayFileName(name).toLowerCase().split(".").pop() || "";
}

export function safeFileName(name: string) {
  const ext = extension(name).replace(/[^a-z0-9]/g, "").slice(0, 12) || "bin";
  const base = asciiStorageBase(displayFileName(name).replace(/\.[^.]+$/, ""));
  return `${base}.${ext}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  txt: "text/plain", log: "text/plain", md: "text/markdown", markdown: "text/markdown", csv: "text/csv",
  json: "application/json", xml: "application/xml", html: "text/html", htm: "text/html", rtf: "application/rtf",
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function assertFileSignature(ext: string, bytes: Buffer) {
  if (ext === "pdf" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Расширение PDF не соответствует содержимому файла.");
  if (ext === "docx" && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error("Расширение DOCX не соответствует содержимому файла.");
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
  assertFileSignature(ext, bytes);
  let text = "";
  if (TEXT_EXTENSIONS.has(ext)) {
    text = decodeTextBytes(bytes);
    if (ext === "rtf") text = decodeRtfEscapes(text);
  } else if (ext === "docx") {
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else if (ext === "pdf") {
    text = (await extractPdfText(new Uint8Array(bytes), { mergePages: true })).text;
  }

  text = normalizeText(text).slice(0, 50000);
  if (text.length < 40) throw new Error(`В файле «${file.name}» не удалось найти достаточно текста.`);
  return { bytes, text, safeName: safeFileName(file.name), displayName: displayFileName(file.name), mimeType: MIME_BY_EXTENSION[ext] || "application/octet-stream" };
}

export function validateFiles(files: File[]) {
  if (!files.length) return;
  if (files.length > MAX_FILES) throw new Error(`Можно загрузить не более ${MAX_FILES} файлов за один анализ.`);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error("Общий размер файлов должен быть меньше 4 МБ.");
}
