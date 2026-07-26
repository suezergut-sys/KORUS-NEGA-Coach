export const ONBOARDING_STORAGE_KEY = "korus-nega-onboarding-v2";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export function shouldAutoOpenOnboarding({
  pathname,
  requested,
  completed,
}: {
  pathname: string;
  requested: boolean;
  completed: boolean;
}) {
  if (requested) return true;
  const isAuthenticatedArea = !PUBLIC_PATHS.has(pathname) && !pathname.startsWith("/admin");
  return isAuthenticatedArea && !completed;
}
