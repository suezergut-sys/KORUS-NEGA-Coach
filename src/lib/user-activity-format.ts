export type UserActivityType = "case_played" | "case_uploaded" | "case_created";

export type MoscowWeek = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
};

export type WeeklyActivitySummary = {
  activeUsers: number;
  playedCases: number;
  createdCases: number;
  uploadedCases: number;
};

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

function dateOnlyInMoscow(instant: Date) {
  return new Date(instant.getTime() + MOSCOW_OFFSET_MS).toISOString().slice(0, 10);
}

export function previousMoscowWeek(now = new Date()): MoscowWeek {
  const moscow = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  const daysSinceMonday = (moscow.getUTCDay() + 6) % 7;
  const currentMondayLocal = Date.UTC(
    moscow.getUTCFullYear(),
    moscow.getUTCMonth(),
    moscow.getUTCDate() - daysSinceMonday,
  );
  const end = new Date(currentMondayLocal - MOSCOW_OFFSET_MS);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return {
    start,
    end,
    startDate: dateOnlyInMoscow(start),
    endDate: dateOnlyInMoscow(new Date(end.getTime() - 1)),
  };
}

export function formatActivityMessage(userName: string, type: UserActivityType, subjectTitle?: string | null) {
  const action: Record<UserActivityType, string> = {
    case_played: "отыграл(а) кейс",
    case_uploaded: "загрузил(а) кейс",
    case_created: "создал(а) кейс",
  };
  const title = subjectTitle?.trim() ? ` «${subjectTitle.trim()}»` : "";
  return `${userName} — ${action[type]}${title}.`;
}

export function formatWeeklyActivitySummary(week: MoscowWeek, summary: WeeklyActivitySummary) {
  return [
    '<b>Статистика использования платформы <a href="https://korus-nega-coach.vercel.app/">KORUS NEGA AI 2.0</a></b>',
    "",
    `Отчёт за ${week.startDate}–${week.endDate}`,
    "",
    `Активных пользователей: ${summary.activeUsers}`,
    `Отыгранных кейсов: ${summary.playedCases}`,
    `Созданных кейсов: ${summary.createdCases} (из них загружено: ${summary.uploadedCases})`,
  ].join("\n");
}

