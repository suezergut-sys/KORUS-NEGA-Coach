import type { UserActivityType } from "@/lib/user-activity-format";

export const ADMIN_LOG_PAGE_SIZE = 50;

export const ADMIN_ACTIVITY_LABELS: Record<UserActivityType, string> = {
  user_registered: "Регистрация на платформе",
  user_logged_in: "Вход на платформу",
  case_created: "Создание кейса",
  case_uploaded: "Загрузка кейса",
  duel_analyzed: "Анализ поединка",
  case_played: "Проведение поединка",
  feedback_submitted: "Оставил(а) обратную связь",
};

export function parseAdminLogPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function formatAdminDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
