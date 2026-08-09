import AppNavRail from "@/components/AppNavRail";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="analysis-upload-shell">
      <AppNavRail isAdministrator={await isAdminAuthenticated()} />
      <div className="analysis-upload-main">{children}</div>
    </main>
  );
}
