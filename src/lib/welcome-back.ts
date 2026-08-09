export function shouldOpenWelcomeBack({
  pathname,
  requested,
  onboardingCompleted,
}: {
  pathname: string;
  requested: boolean;
  onboardingCompleted: boolean;
}) {
  return requested
    && onboardingCompleted
    && pathname !== "/login"
    && pathname !== "/register"
    && !pathname.startsWith("/admin");
}
