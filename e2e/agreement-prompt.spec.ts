import { expect, type Page, test } from "@playwright/test";

async function openNegotiationWithAgreement(page: Page) {
  let turn = 0;
  await page.route("**/api/cases", (route) => route.fulfill({ json: { cases: [] } }));
  await page.route("**/api/account/privacy", (route) => route.fulfill({ json: { consent: true } }));
  await page.route("**/api/sessions", (route) => route.fulfill({
    status: 201,
    json: { sessionId: "agreement-session", startedAt: new Date().toISOString() },
  }));
  await page.route("**/api/text-negotiation", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    const body = route.request().postDataJSON() as { action?: string };
    if (body.action === "start") {
      await route.fulfill({ json: { reply: "Давайте обсудим условия." } });
      return;
    }
    turn += 1;
    const replies = [
      "Назовите ваши приоритеты.",
      "Срок для меня важен.",
      "Согласен, так и будем действовать.",
    ];
    await route.fulfill({ json: { reply: replies[turn - 1] } });
  });

  await page.goto("/e2e/text-mode");
  await page.getByRole("button", { name: /НАЧАТЬ/ }).click();
  await expect(page.getByLabel("Ваша реплика")).toBeEnabled();

  for (const text of [
    "Мне важны сроки и качество.",
    "Готов обсудить конкретную дату.",
    "Предлагаю зафиксировать срок 15 сентября.",
  ]) {
    await page.getByLabel("Ваша реплика").fill(text);
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByText("Оппонент печатает ответ…")).toBeHidden();
  }

  await expect(page.getByRole("dialog", { name: "Похоже, договорённость достигнута" })).toBeVisible();
}

test("при двусторонней договорённости можно продолжить переговоры", async ({ page }) => {
  await openNegotiationWithAgreement(page);
  await page.getByRole("button", { name: "НЕТ, ПРОДОЛЖИТЬ" }).click();
  await expect(page.getByRole("dialog", { name: "Похоже, договорённость достигнута" })).toBeHidden();
  await expect(page.getByLabel("Ваша реплика")).toBeEnabled();
});

test("подтверждение договорённости завершает поединок и запускает анализ", async ({ page }) => {
  await page.route("**/api/sessions/agreement-session", (route) => route.fulfill({ json: { metrics: {} } }));
  await page.route("**/api/analysis", (route) => route.fulfill({ status: 503, json: { error: "Тестовая остановка после запуска анализа." } }));
  await openNegotiationWithAgreement(page);

  const analysisRequest = page.waitForRequest((request) => request.url().endsWith("/api/analysis") && request.method() === "POST");
  await page.getByRole("button", { name: "ДА, ЗАВЕРШИТЬ" }).click();
  await analysisRequest;
  await expect(page.getByText("Переговоры завершены после достижения договорённости.")).toBeVisible();
});
