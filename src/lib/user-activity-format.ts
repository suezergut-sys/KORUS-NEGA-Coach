export type UserActivityType =
  | "case_played"
  | "case_uploaded"
  | "case_created"
  | "user_registered"
  | "user_logged_in"
  | "feedback_submitted"
  | "duel_analyzed";

export const ADMIN_FEEDBACK_URL = "https://korus-nega-coach.vercel.app/admin/feedback";

export function formatActivityMessage(userName: string, type: UserActivityType, subjectTitle?: string | null) {
  if (type === "user_registered") {
    const email = subjectTitle?.trim() || "не указана";
    return `${userName} — зарегистрировался(ась) на платформе.\nПочта: ${email}.`;
  }
  if (type === "user_logged_in") return `${userName} — вошёл (вошла) на платформу.`;
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
    user_logged_in: "вошёл (вошла) на платформу",
    feedback_submitted: "оставил(а) обратную связь",
    duel_analyzed: "проанализировал(а) поединок",
  };
  const title = subjectTitle?.trim() ? ` «${subjectTitle.trim()}»` : "";
  return `${userName} — ${action[type]}${title}.`;
}

