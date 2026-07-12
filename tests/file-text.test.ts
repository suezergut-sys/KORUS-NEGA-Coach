import { describe, expect, it } from "vitest";
import { asciiStorageBase, decodeRtfEscapes, decodeTextBytes, displayFileName } from "../src/lib/file-text";

describe("русские кодировки файлов", () => {
  it("читает UTF-8 с BOM и нормализует Unicode", () => {
    const body = new TextEncoder().encode("И\u0306рина;цель");
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...body]);
    expect(decodeTextBytes(bytes)).toBe("Йрина;цель");
  });

  it("определяет Windows-1251 без BOM", () => {
    const bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x2c, 0xec, 0xe8, 0xf0]);
    expect(decodeTextBytes(bytes)).toBe("Привет,мир");
  });

  it("учитывает XML-декларацию Windows-1251", () => {
    const prefix = new TextEncoder().encode('<?xml version="1.0" encoding="windows-1251"?><p>');
    const suffix = new TextEncoder().encode("</p>");
    const bytes = Uint8Array.from([...prefix, 0xd2, 0xe5, 0xf1, 0xf2, ...suffix]);
    expect(decodeTextBytes(bytes)).toContain("<p>Тест</p>");
  });

  it("не декодирует объявленную неподдерживаемую кодировку наугад", () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="koi8-r"?><p>test</p>');
    expect(() => decodeTextBytes(bytes)).toThrow("не поддерживается");
  });

  it("декодирует кириллицу в RTF escape-последовательностях", () => {
    expect(decodeRtfEscapes("{\\rtf1 \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2}")).toContain("Привет");
  });
});

describe("имена файлов", () => {
  it("сохраняет безопасное русское отображаемое имя", () => {
    expect(displayFileName("Отчёт\u202E/июль.csv")).toBe("Отчёт-июль.csv");
  });

  it("создаёт читаемый ASCII-ключ", () => {
    expect(asciiStorageBase("Сложный отчёт Июль")).toBe("slozhnyi-otchet-iyul");
  });
});
