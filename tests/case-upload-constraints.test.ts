import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  UploadValidationError,
  validateUploadSelection,
} from "../src/lib/case-upload-constraints";

function file(name: string, size: number) {
  return { name, size } as File;
}

describe("ограничения материалов кейса", () => {
  it("отвергает неподдерживаемое расширение до отправки", () => {
    expect(() => validateUploadSelection([file("legacy.doc", 1000)])).toThrow(UploadValidationError);
  });

  it("отвергает отдельный слишком большой файл", () => {
    expect(() => validateUploadSelection([file("case.pdf", MAX_FILE_BYTES + 1)])).toThrow("меньше 3 МБ");
  });

  it("учитывает материалы, уже сохранённые в черновике", () => {
    expect(() => validateUploadSelection(
      [file("new.txt", 2)],
      { count: 2, totalBytes: MAX_TOTAL_BYTES - 1 },
    )).toThrow("Общий размер файлов в черновике");
  });

  it("учитывает число ранее сохранённых файлов", () => {
    expect(() => validateUploadSelection([file("new.txt", 100)], { count: 6 })).toThrow("не более 6 файлов");
  });
});
