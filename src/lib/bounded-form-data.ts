import "server-only";

import { UploadValidationError } from "@/lib/case-upload-constraints";

export async function readBoundedFormData(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new UploadValidationError("Ожидалась загрузка формы с файлами.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new UploadValidationError("Размер запроса превышает допустимый предел.", 413);
  }
  if (!request.body) throw new UploadValidationError("Пустой запрос.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UploadValidationError("Размер запроса превышает допустимый предел.", 413);
    }
    chunks.push(value);
  }

  const parts = chunks.map((chunk) => chunk.slice().buffer as ArrayBuffer);
  return new Response(new Blob(parts), { headers: { "Content-Type": contentType } }).formData();
}
