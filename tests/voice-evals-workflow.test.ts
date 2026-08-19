import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live voice eval workflow", () => {
  it("runs paid OpenAI scenarios only when started manually", () => {
    const workflow = readFileSync(".github/workflows/voice-evals.yml", "utf8");

    expect(workflow).toMatch(/^\s{2}workflow_dispatch:\s*$/m);
    expect(workflow).not.toMatch(/^\s{2}schedule:\s*$/m);
    expect(workflow).toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(workflow).toContain("npm run test:voice-evals");
  });
});
