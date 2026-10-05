import { describe, expect, it } from "vitest";
import {
  ADMIN_FEEDBACK_URL,
  formatActivityMessage,
} from "../src/lib/user-activity-format";

describe("Telegram activity monitoring", () => {
  it("formats immediate notifications with the user's full name and action", () => {
    expect(formatActivityMessage("Максим Сумин", "case_played", "Сорванный срок"))
      .toBe("Максим Сумин — отыграл(а) кейс «Сорванный срок».");
    expect(formatActivityMessage("Максим Сумин", "case_uploaded"))
      .toBe("Максим Сумин — загрузил(а) кейс.");
    expect(formatActivityMessage("Анна Иванова", "user_registered", "a.ivanova@korusconsulting.ru"))
      .toBe("Анна Иванова — зарегистрировался(ась) на платформе.\nПочта: a.ivanova@korusconsulting.ru.");
    expect(formatActivityMessage("Максим Сумин", "feedback_submitted", "Анализ кейса"))
      .toBe(`Максим Сумин — оставил(а) обратную связь по разделу «Анализ кейса».\nОткрыть в админ-панели: ${ADMIN_FEEDBACK_URL}`);
    expect(formatActivityMessage("Максим Сумин", "duel_analyzed", "Встреча.txt"))
      .toBe("Максим Сумин — проанализировал(а) поединок по кейсу «Встреча.txt».");
  });
});
