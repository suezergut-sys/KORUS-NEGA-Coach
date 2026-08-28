export const PLATFORM_ADMINISTRATORS = [
  {
    firstName: "Максим",
    lastName: "Сумин",
    email: "msumin@korusconsulting.ru",
  },
  {
    firstName: "Алина",
    lastName: "Родченкова",
    email: "arodchenkova@korusconsulting.ru",
  },
] as const;

const ADMIN_EMAILS = new Set<string>(PLATFORM_ADMINISTRATORS.map((administrator) => administrator.email));

export function isPlatformAdministrator(email?: string | null) {
  return ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}

export function platformRoleLabel(email?: string | null) {
  return isPlatformAdministrator(email) ? "Администратор" : "Пользователь";
}
