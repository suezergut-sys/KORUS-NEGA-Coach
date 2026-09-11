import { test, expect } from "@playwright/test";
import { installVoiceEvalBridge, playVoiceEvalAudio, readVoiceEvalRecords, waitForVoiceEvalRecord } from "./browser-driver";
import { synthesizeUserPhrase } from "./openai-support";

test("Дуплекс Live: русский диалог, backend, пауза и финальная стенограмма", async ({ page }, testInfo) => {
  test.skip(process.env.RUN_LIVE_VOICE_EVALS !== "1" || !process.env.OPENAI_API_KEY, "Requires live API access");
  test.setTimeout(180_000);
  await installVoiceEvalBridge(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let snapshot: { turns?: Array<{ author: string; text: string }>; metrics?: { inputMode: string; liveComparison?: { delegationCount: number; backendDurationsMs: number[] } } } = {};
  await page.route("**/api/sessions/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    snapshot = route.request().postDataJSON();
    await route.fulfill({ json: { status: "analysis_pending", metrics: {} } });
  });
  await page.route("**/api/analysis", (route) => route.fulfill({ status: 503, json: { error: "Проверка: стенограмма сохранена, анализ не запускается в голосовом eval." } }));
  await page.goto("/e2e/voice-eval");
  await page.getByRole("button", { name: "Дуплекс Live", exact: true }).click();
  await page.getByRole("button", { name: /НАЧАТЬ/ }).click();
  try {
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "session.started" }, 55_000);
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "session.output_transcript.delta" }, 30_000);
    await expect(page.locator(".voice-comparison")).toContainText("эксперимент");
    await expect(page.locator(".listening-copy small")).toHaveText("Слушаю…", { timeout: 30_000 });
    const speech = await synthesizeUserPhrase("Предлагаю выделить вам дополнительного аналитика и вместе составить план восстановления проекта на десять рабочих дней. Какие условия вам нужны, чтобы принять ответственность за свою часть?");
    await playVoiceEvalAudio(page, speech.bytes.toString("base64"));
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "session.input_transcript.delta" }, 30_000);
    await expect.poll(async () => (await readVoiceEvalRecords(page)).some((e) => e.details.nestedType === "response.completed"), { timeout: 45_000 }).toBe(true);
    await expect(page.locator(".voice-comparison")).toContainText(/ответов [1-9]/, { timeout: 30_000 });
    const records = await readVoiceEvalRecords(page);
    const text = records.filter((e) => e.name === "session.output_transcript.delta").map((e) => e.details.delta).join("");
    expect(text).toMatch(/[А-Яа-яЁё]/);
    expect(records.some((e) => e.name === "error")).toBe(false);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "session.input_audio.muted" }, 10_000);
    await page.getByRole("button", { name: /Продолжить переговоры/ }).click();
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "session.input_audio.unmuted" }, 10_000);
    await page.getByRole("button", { name: /ЗАВЕРШИТЬ/ }).click();
    await expect.poll(() => snapshot.metrics?.inputMode, { timeout: 20_000 }).toBe("duplex_live");
    expect(snapshot.metrics?.liveComparison?.delegationCount).toBeGreaterThan(0);
    expect(snapshot.metrics?.liveComparison?.backendDurationsMs.length).toBeGreaterThan(0);
    expect(snapshot.turns?.some((t) => t.author === "Вы" && /аналитик|план|дней/.test(t.text))).toBe(true);
    expect(snapshot.turns?.some((t) => t.author === "Оппонент" && /[А-Яа-я]/.test(t.text))).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    if (!page.isClosed()) await testInfo.attach("live-events.json", { body: JSON.stringify(await readVoiceEvalRecords(page), null, 2), contentType: "application/json" });
    await testInfo.attach("live-final-snapshot.json", { body: JSON.stringify(snapshot, null, 2), contentType: "application/json" });
  }
});
