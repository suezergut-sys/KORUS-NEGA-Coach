import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/e2e/p2");
});

test("запуск и пауза голосовой тренировки", async ({ page }) => {
  await page.getByTestId("start").click();
  await expect(page.getByTestId("phase")).toHaveText("live");
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("phase")).toHaveText("paused");
  await page.getByTestId("resume").click();
  await expect(page.getByTestId("phase")).toHaveText("live");
});

test("обрыв связи сохраняет активную сессию", async ({ page }) => {
  await page.getByTestId("start").click();
  await expect(page.getByTestId("phase")).toHaveText("live");
  await page.getByTestId("disconnect").click();
  await expect(page.getByTestId("phase")).toHaveText("live");
  await expect(page.getByTestId("connection")).toHaveText("degraded");
});

test("повторный анализ завершает сохраненную сессию", async ({ page }) => {
  await page.getByTestId("start").click();
  await expect(page.getByTestId("phase")).toHaveText("live");
  await page.getByTestId("end").click();
  await expect(page.getByTestId("retry")).toBeVisible();
  await expect(page.getByTestId("phase")).toHaveText("complete");
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("analysis")).toHaveText("ready");
  await expect(page.getByTestId("phase")).toHaveText("complete");
});

test("название приватного кейса скрыто от другого пользователя", async ({ page }) => {
  await expect(page.getByTestId("private-case")).toHaveText("Приватный кейс пользователя");
  await page.getByTestId("toggle-owner").click();
  await expect(page.getByTestId("private-case")).toHaveText("Секретное сокращение штата");
});

test("речевая аналитика доступна только в дуплексном режиме", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Как вы говорили и реагировали" })).toBeVisible();
  await expect(page.getByText("40%", { exact: true })).toBeVisible();
  await page.getByTestId("ordinary-mode").click();
  await expect(page.getByRole("heading", { name: "Как вы говорили и реагировали" })).toHaveCount(0);
  await page.getByTestId("duplex-mode").click();
  await expect(page.getByRole("heading", { name: "Как вы говорили и реагировали" })).toBeVisible();
});
