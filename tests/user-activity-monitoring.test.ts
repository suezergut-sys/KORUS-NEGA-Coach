import { describe, expect, it } from "vitest";
import {
  formatActivityMessage,
  formatWeeklyActivitySummary,
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
  });

  it("formats every requested weekly metric", () => {
    const week = previousMoscowWeek(new Date("2026-07-27T06:00:00.000Z"));
    const message = formatWeeklyActivitySummary(week, {
      activeUsers: 7,
      playedCases: 12,
      createdCases: 4,
      uploadedCases: 1,
    });

    expect(message).toContain('<b>Статистика использования платформы <a href="https://korus-nega-coach.vercel.app/">KORUS NEGA AI 2.0</a></b>');
    expect(message).toContain("2026-07-20–2026-07-26");
    expect(message).toContain("Активных пользователей: 7");
    expect(message).toContain("Отыгранных кейсов: 12");
    expect(message).toContain("Созданных кейсов: 4 (из них загружено: 1)");
  });
});
