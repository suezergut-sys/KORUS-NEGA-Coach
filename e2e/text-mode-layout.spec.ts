import { expect, test } from "@playwright/test";

test("текстовый режим выбран первым и оставляет больше места стенограмме", async ({ page }) => {
  await page.goto("/e2e/text-mode");

  const modeButtons = page.getByRole("group", { name: "Голосовой режим" }).getByRole("button");
  await expect(modeButtons).toHaveText(["Только текст", "Обычный", "Дуплекс"]);
  await expect(page.getByRole("button", { name: "Только текст" })).toHaveAttribute("aria-pressed", "true");

  const dialogueHeight = await page.locator(".dialogue-surface.text-only").evaluate((element) => element.getBoundingClientRect().height);
  const composerHeight = await page.locator(".text-negotiation-composer").evaluate((element) => element.getBoundingClientRect().height);
  const textareaHeight = await page.getByLabel("Ваша реплика").evaluate((element) => element.getBoundingClientRect().height);

  expect(dialogueHeight).toBeGreaterThanOrEqual(550);
  expect(composerHeight).toBeLessThan(170);
  expect(textareaHeight).toBeLessThanOrEqual(70);
});
