import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin case visibility column", () => {
  it("loads visibility and renders public/private/department labels in the case registry", () => {
    const page = readFileSync("src/app/admin/(protected)/cases/page.tsx", "utf8");
    const list = readFileSync("src/components/AdminCaseList.tsx", "utf8");

    expect(page).toMatch(/select\("[^"]*visibility[^"]*"\)/);
    expect(page).toContain('item.visibility === "private" || item.visibility === "department"');
    expect(list).toContain("<th>Доступ</th>");
    expect(list).toContain('department: "Департамент"');
  });
});

