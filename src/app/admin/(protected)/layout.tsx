import AppNavRail from "@/components/AppNavRail";
import { requireAdmin } from "@/lib/admin-auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <AppNavRail isAdministrator prefetch={false} />
      <div className="admin-main">
        <nav className="admin-section-nav" aria-label="Разделы админ-панели">
          <Link href="/admin" prefetch={false}>Обзор</Link>
          <Link href="/admin/users" prefetch={false}>Пользователи</Link>
          <Link href="/admin/logs" prefetch={false}>Логи</Link>
          <Link href="/admin/methodology" prefetch={false}>Методология</Link>
          <Link href="/admin/cases" prefetch={false}>База кейсов</Link>
          <Link href="/admin/feedback" prefetch={false}>Обратная связь</Link>
          <Link href="/admin/platform-testing" prefetch={false}>Тестирование</Link>
          <Link href="/admin/infrastructure" prefetch={false}>Лимиты</Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
