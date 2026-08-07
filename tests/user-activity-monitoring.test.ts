import { describe, expect, it } from "vitest";
import {
  ADMIN_FEEDBACK_URL,
  formatActivityMessage,
  formatWeeklyActivitySummary,
  platformUpdatesForWeek,
  previousMoscowWeek,
} from "../src/lib/user-activity-format";

describe("Telegram activity monitoring", () => {
  it("uses the previous complete Moscow Monday-to-Sunday period", () => {
    const week = previousMoscowWeek(new Date("2026-07-31T16:00:00.000Z"));

    expect(week.start.toISOString()).toBe("2026-07-19T21:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-07-26T21:00:00.000Z");
    expect(week.startDate).toBe("2026-07-20");
    expect(week.endDate).toBe("2026-07-26");
  });

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

  it("formats every requested weekly metric", () => {
    const week = previousMoscowWeek(new Date("2026-07-27T06:00:00.000Z"));
    const message = formatWeeklyActivitySummary(week, {
      activeUsers: 7,
      newUsers: 3,
      playedCases: 12,
      createdCases: 4,
      uploadedCases: 1,
    });

    expect(message).toContain('<b>Статистика использования платформы <a href="https://korus-nega-coach.vercel.app/">KORUS NEGA AI 2.0</a></b>');
    expect(message).toContain("2026-07-20–2026-07-26");
    expect(message).toContain("Активных пользователей: 7");
    expect(message).toContain("Новых пользователей: 3");
    expect(message).toContain("Отыгранных кейсов: 12");
    expect(message).toContain("Созданных кейсов: 4 (из них загружено: 1)");
    expect(message).toContain("Дайджест доработок платформы");
    expect(message).toContain("За отчётный период доработок не зафиксировано.");
  });

  it("includes only improvements from the reported week and escapes Telegram HTML", () => {
    const week = previousMoscowWeek(new Date("2026-08-10T06:00:00.000Z"));
    const updates = platformUpdatesForWeek(week, [
      { pr: 78, date: "2026-08-07", title: "Метрики <Telegram> & дайджест" },
      { pr: 67, date: "2026-07-31", title: "Старое изменение" },
    ]);
    const message = formatWeeklyActivitySummary(week, {
      activeUsers: 1,
      newUsers: 1,
      playedCases: 0,
      createdCases: 0,
      uploadedCases: 0,
    }, updates);

    expect(updates.map((item) => item.pr)).toEqual([78]);
    expect(message).toContain('<a href="https://github.com/suezergut-sys/KORUS-NEGA-Coach/pull/78">PR #78</a>');
    expect(message).toContain("Метрики &lt;Telegram&gt; &amp; дайджест");
    expect(message).not.toContain("Старое изменение");
  });
});
