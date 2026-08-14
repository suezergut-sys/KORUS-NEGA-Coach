import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const switcher = readFileSync(new URL("../src/components/ReportMethodologySwitcher.tsx", import.meta.url), "utf8");
const report = readFileSync(new URL("../src/components/NegotiationReport.tsx", import.meta.url), "utf8");
const analysisRoute = readFileSync(new URL("../src/app/api/analysis/route.ts", import.meta.url), "utf8");

describe("повторный анализ отчёта по другой методологии", () => {
  it("показывает выбор методологии и явную кнопку генерации внизу отчёта", () => {
    expect(report).toContain("ReportMethodologySwitcher");
    expect(report.indexOf("report-footer")).toBeLessThan(report.indexOf("<ReportMethodologySwitcher"));
    expect(switcher).toContain("СГЕНЕРИРОВАТЬ ОТЧЁТ");
    expect(switcher).toContain("methodologyOptions()");
    expect(switcher).toContain("selectedId === methodologyId");
  });

  it("передаёт выбранную методологию серверу и сохраняет прежний отчёт при ошибке", () => {
    expect(switcher).toContain("JSON.stringify({ sessionId, methodologyId: selectedId })");
    expect(switcher).toContain("текущий отчёт будет заменён только после успешного анализа");
    expect(analysisRoute).toContain("isMethodologyId(body.methodologyId)");
    expect(analysisRoute).toContain(".upsert({");
    expect(analysisRoute).toContain("methodology_id: methodologyId");
    expect(analysisRoute).toContain('status: hadStoredAnalysis ? "analyzed" : "analysis_failed"');
  });
});
