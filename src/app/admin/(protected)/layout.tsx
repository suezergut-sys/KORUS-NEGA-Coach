import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-logo"><strong>K</strong><span>KORUS NEGA AI<small>ADMIN</small></span></Link>
        <nav aria-label="Админ-панель">
          <Link href="/admin">⌂ <span>Обзор</span></Link>
          <Link href="/admin/methodology">▤ <span>Методология</span></Link>
          <Link href="/cases">＋ <span>Конструктор кейсов</span></Link>
          <a href="https://supabase.com/dashboard/project/byglrikxpipspkycjmkf" target="_blank" rel="noreferrer">◈ <span>Supabase</span></a>
        </nav>
        <form action="/api/admin/logout" method="post"><button type="submit">⇥ <span>Выйти</span></button></form>
      </aside>
      <div className="admin-main">{children}</div>
    </main>
  );
}
