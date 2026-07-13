import AppNavRail from "@/components/AppNavRail";
import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <AppNavRail />
      <div className="admin-main">
        <nav className="admin-section-nav" aria-label="Разделы админ-панели">
          <Link href="/admin">Обзор</Link>
          <Link href="/admin/methodology">Методология</Link>
          <Link href="/admin/cases">База кейсов</Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
