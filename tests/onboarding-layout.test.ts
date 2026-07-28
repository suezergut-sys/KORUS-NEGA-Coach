import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("onboarding layout", () => {
  it("uses one desktop grid with a continuous visual column", () => {
    expect(css).toMatch(/\.onboarding-dialog\s*\{[^}]*height:\s*min\(680px,\s*calc\(100dvh - 48px\)\)/);
    expect(css).toMatch(/\.onboarding-dialog\s*\{[^}]*grid-template-columns:\s*minmax\(280px,\s*\.82fr\)\s+minmax\(0,\s*1\.18fr\)/);
    expect(css).toMatch(/\.onboarding-card\s*\{[^}]*display:\s*contents/);
    expect(css).toMatch(/\.onboarding-card-visual\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1\s*\/\s*-1/);
    expect(css).toMatch(/\.onboarding-actions\s*\{[^}]*grid-column:\s*2/);
    expect(css).not.toContain("linear-gradient(to right, #1d1a42 0 37.3%");
  });

  it("keeps every mobile step at the same available viewport height", () => {
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.onboarding-dialog\s*\{[^}]*height:\s*calc\(100dvh - 20px\)/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.onboarding-card-visual\s*\{[^}]*grid-row:\s*1/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.onboarding-actions\s*\{[^}]*grid-row:\s*4/);
  });
});
