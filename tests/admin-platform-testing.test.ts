import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin platform testing surface", () => {
  it("is linked from the protected admin navigation", () => {
    const layout = readFileSync("src/app/admin/(protected)/layout.tsx", "utf8");
    const page = readFileSync("src/app/admin/(protected)/platform-testing/page.tsx", "utf8");
    expect(layout).toContain('href="/admin/platform-testing"');
    expect(page).toContain("<PlatformTestingPanel cases={cases} />");
  });

  it("keeps every test API behind the administrator check", () => {
    for (const route of ["realtime", "human-turn", "report"]) {
      const source = readFileSync(`src/app/api/admin/platform-testing/${route}/route.ts`, "utf8");
      expect(source).toContain("rejectNonAdminApiRequest");
    }
  });

  it("renders opponent audio, transcript and anomaly report", () => {
    const component = readFileSync("src/components/PlatformTestingPanel.tsx", "utf8");
    expect(component).toContain('aria-label="Речь AI-оппонента"');
    expect(component).toContain("platform-test-transcript");
    expect(component).toContain("ОТЧЁТ О ТЕСТИРОВАНИИ");
    expect(component).toContain("/api/admin/platform-testing/human-turn");
    expect(component).toContain("/api/admin/platform-testing/report");
  });
});
