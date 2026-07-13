import "server-only";

import mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";
import { asciiStorageBase, decodeRtfEscapes, decodeTextBytes, displayFileName } from "@/lib/file-text";
import { ALLOWED_CASE_EXTENSIONS, MAX_FILE_BYTES, UploadValidationError, validateUploadSelection } from "@/lib/case-upload-constraints";

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "rtf", "log"]);

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
  if (ext === "pdf" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new UploadValidationError("Расширение PDF не соответствует содержимому файла.");
  if (ext === "docx") assertSafeDocxArchive(bytes);
}

function assertSafeDocxArchive(bytes: Buffer) {
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new UploadValidationError("Расширение DOCX не соответствует содержимому файла.");

  const entries = bytes.readUInt16LE(eocd + 10);
  const directorySize = bytes.readUInt32LE(eocd + 12);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (!entries || entries > 1_000 || directoryOffset + directorySize > bytes.length) {
    throw new UploadValidationError("Структура DOCX повреждена или слишком сложна.");
  }

  let offset = directoryOffset;
  let totalUncompressed = 0;
  let hasContentTypes = false;
  for (let entry = 0; entry < entries; entry += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new UploadValidationError("Структура DOCX повреждена.");
    }
    const compressed = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (compressed === 0xffffffff || uncompressed === 0xffffffff || nextOffset > bytes.length) {
      throw new UploadValidationError("ZIP64 и повреждённые DOCX не поддерживаются.");
    }
    totalUncompressed += uncompressed;
    if (totalUncompressed > 40 * 1024 * 1024 || (uncompressed > 10 * 1024 * 1024 && compressed > 0 && uncompressed / compressed > 250)) {
      throw new UploadValidationError("Содержимое DOCX слишком велико после распаковки.", 413);
    }
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === "[Content_Types].xml") hasContentTypes = true;
    offset = nextOffset;
  }
  if (!hasContentTypes) throw new UploadValidationError("Файл не является корректным DOCX-документом.");
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
  if (!ALLOWED_CASE_EXTENSIONS.has(ext)) {
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
  if (text.length < 40) throw new UploadValidationError(`В файле «${file.name}» не удалось найти достаточно текста.`);
  return { bytes, text, safeName: safeFileName(file.name), displayName: displayFileName(file.name), mimeType: MIME_BY_EXTENSION[ext] || "application/octet-stream" };
}

export function validateFiles(files: File[], existing: { count?: number; totalBytes?: number } = {}) {
  validateUploadSelection(files, existing);
}
