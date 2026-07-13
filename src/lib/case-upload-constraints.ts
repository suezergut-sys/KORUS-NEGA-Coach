export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 6;
export const QUICK_UPLOAD_REQUEST_BYTES = MAX_FILE_BYTES + 256 * 1024;
export const BUILDER_UPLOAD_REQUEST_BYTES = MAX_TOTAL_BYTES + 512 * 1024;

export const ALLOWED_CASE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "rtf", "log", "pdf", "docx",
]);

export class UploadValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function uploadExtension(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

export function validateUploadSelection(
  files: Array<Pick<File, "name" | "size">>,
  existing: { count?: number; totalBytes?: number } = {},
) {
  const count = (existing.count || 0) + files.length;
  if (count > MAX_FILES) throw new UploadValidationError(`В черновике может быть не более ${MAX_FILES} файлов.`);

  for (const file of files) {
    const ext = uploadExtension(file.name);
    if (!ALLOWED_CASE_EXTENSIONS.has(ext)) {
      throw new UploadValidationError(`Формат .${ext || "без расширения"} не поддерживается. Используйте TXT, MD, CSV, JSON, XML, HTML, RTF, PDF или DOCX.`);
    }
    if (!file.size || file.size > MAX_FILE_BYTES) {
      throw new UploadValidationError(`Файл «${file.name}» должен быть меньше 3 МБ.`);
    }
  }

  const total = (existing.totalBytes || 0) + files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new UploadValidationError("Общий размер файлов в черновике должен быть меньше 4 МБ.");
}

export function uploadErrorStatus(error: unknown) {
  return error instanceof UploadValidationError ? error.status : 500;
}
