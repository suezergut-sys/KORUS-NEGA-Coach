import { describe, expect, it } from "vitest";
import { buildNegotiationReportHtml, reportHtmlFileName } from "@/lib/report-html";

const meta = {
  occurredAt: "2026-08-24T10:45:00.000Z",
  caseTitle: "1С Увольнение <тест>",
  userFullName: "Иван & Петров",
  participantRole: "Руководитель",
};

describe("HTML-экспорт отчёта", () => {
  it("создаёт автономный HTML с метаданными поединка и полным содержанием отчёта", () => {
    const html = buildNegotiationReportHtml({
      contentHtml: '<div class="negotiation-report"><h2>Содержание отчёта</h2><p>Сильные ходы и риски</p></div>',
      meta,
    });

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("24 августа 2026 г.");
    expect(html).toContain("13:45 МСК");
    expect(html).toContain("1С Увольнение &lt;тест&gt;");
    expect(html).toContain("Иван &amp; Петров");
    expect(html).toContain("Роль в поединке");
    expect(html).toContain("Руководитель");
    expect(html).toContain("Содержание отчёта");
    expect(html).toContain("Сильные ходы и риски");
  });

  it("формирует безопасное понятное имя HTML-файла", () => {
    expect(reportHtmlFileName(meta)).toBe("otchet-1с-увольнение-тест-2026-08-24.html");
  });
});
