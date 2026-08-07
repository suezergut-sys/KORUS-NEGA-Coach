export type UserActivityType =
  | "case_played"
  | "case_uploaded"
  | "case_created"
  | "user_registered"
  | "feedback_submitted"
  | "duel_analyzed";

export const ADMIN_FEEDBACK_URL = "https://korus-nega-coach.vercel.app/admin/feedback";

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
  if (type === "user_registered") {
    const email = subjectTitle?.trim() || "не указана";
    return `${userName} — зарегистрировался(ась) на платформе.\nПочта: ${email}.`;
  }
  if (type === "feedback_submitted") {
    const section = subjectTitle?.trim();
    const sectionText = section ? ` по разделу «${section}»` : "";
    return `${userName} — оставил(а) обратную связь${sectionText}.\nОткрыть в админ-панели: ${ADMIN_FEEDBACK_URL}`;
  }
  if (type === "duel_analyzed") {
    const title = subjectTitle?.trim() ? ` по кейсу «${subjectTitle.trim()}»` : "";
    return `${userName} — проанализировал(а) поединок${title}.`;
  }
  const action: Record<UserActivityType, string> = {
    case_played: "отыграл(а) кейс",
    case_uploaded: "загрузил(а) кейс",
    case_created: "создал(а) кейс",
    user_registered: "зарегистрировался(ась) на платформе",
    feedback_submitted: "оставил(а) обратную связь",
    duel_analyzed: "проанализировал(а) поединок",
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

