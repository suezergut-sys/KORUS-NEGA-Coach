import { describe, expect, it } from "vitest";
import { readJsonResponse } from "../src/lib/http-response";

describe("ответ серверного API", () => {
  it("читает JSON", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(Response.json({ ok: true }))).resolves.toEqual({
      payload: { ok: true },
      isJson: true,
    });
  });

  it("безопасно обрабатывает служебный текст платформы", async () => {
    await expect(readJsonResponse(new Response("An error occurred with your Function invocation", { status: 500 }))).resolves.toEqual({
      payload: null,
      isJson: false,
    });
  });
});
