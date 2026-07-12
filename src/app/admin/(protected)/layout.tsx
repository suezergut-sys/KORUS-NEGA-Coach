import AppNavRail from "@/components/AppNavRail";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <AppNavRail />
      <div className="admin-main">{children}</div>
    </main>
  );
}
