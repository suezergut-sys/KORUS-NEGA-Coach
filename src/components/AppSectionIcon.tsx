import type { AppSectionIconName } from "../lib/app-section-icons";

export { APP_SECTION_ICON_NAMES, type AppSectionIconName } from "../lib/app-section-icons";

export default function AppSectionIcon({ name }: { name: AppSectionIconName }) {
  switch (name) {
    case "negotiations":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h10v7H8l-4 3v-10Z" /><path d="M10 15.5h6l4 3v-10h-3" /></svg>;
    case "account":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M6.5 19c.6-3.2 2.4-5 5.5-5s4.9 1.8 5.5 5" /></svg>;
    case "rating":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V12h3v7H5Zm5.5 0V8h3v11h-3ZM16 19V4h3v15h-3Z" /></svg>;
    case "upload":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M5 14v5h14v-5" /></svg>;
    case "create":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
    case "analyze":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16h8" /><path d="M14 2v5h5m-5-5 5 5v4" /><circle cx="15.5" cy="15.5" r="3.5" /><path d="m18 18 3 3" /></svg>;
    case "feedback":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>;
    case "logout":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" /></svg>;
    case "admin":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4" /></svg>;
    case "mobile":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2" /><path d="M10 18.5h4" /></svg>;
  }
}
