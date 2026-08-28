import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin navigation prefetch", () => {
  it("does not prefetch server-rendered admin sections before an administrator clicks them", () => {
    const layout = readFileSync("src/app/admin/(protected)/layout.tsx", "utf8");
    const appNavRail = readFileSync("src/components/AppNavRail.tsx", "utf8");

    expect(layout).toContain("<AppNavRail isAdministrator prefetch={false} />");
    expect(layout.match(/<Link href="\/admin[^>]*prefetch=\{false\}/g)).toHaveLength(8);
    expect(appNavRail).toContain("prefetch={prefetch}");
  });

  it("does not fan out requests for every case editor from the case registry", () => {
    const caseList = readFileSync("src/components/AdminCaseList.tsx", "utf8");
    const casePage = readFileSync("src/app/admin/(protected)/cases/page.tsx", "utf8");

    expect(caseList).toContain('href={`/admin/cases/${item.id}`} prefetch={false}');
    expect(casePage).toContain('href="/cases" prefetch={false}');
  });
});
