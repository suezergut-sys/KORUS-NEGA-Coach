export const APP_SECTION_ICON_NAMES = [
  "negotiations",
  "account",
  "rating",
  "upload",
  "create",
  "analyze",
  "feedback",
  "about",
  "logout",
  "admin",
  "mobile",
] as const;

export type AppSectionIconName = (typeof APP_SECTION_ICON_NAMES)[number];

export type OnboardingContentIcon = Exclude<AppSectionIconName, "about" | "logout" | "admin">;
