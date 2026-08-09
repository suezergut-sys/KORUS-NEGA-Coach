import AppNavRail from "@/components/AppNavRail";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function CaseLibraryLayout({ children }: { children: React.ReactNode }) {
  return <main className="admin-shell case-library-shell"><AppNavRail isAdministrator={await isAdminAuthenticated()} /><div className="admin-main">{children}</div></main>;
}
