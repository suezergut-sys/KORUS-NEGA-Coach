import Link from "next/link";

export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell case-builder-shell">
      <aside className="admin-sidebar">
        <Link className="admin-logo" href="/"><strong>D</strong><span>DUEL<small>КЕЙСЫ</small></span></Link>
        <nav aria-label="Раздел кейсов">
          <Link href="/">⌂ <span>Переговоры</span></Link>
          <Link href="/cases">＋ <span>Создать кейс</span></Link>
          <Link href="/admin">⚙ <span>Админ-панель</span></Link>
        </nav>
      </aside>
      <div className="admin-main">{children}</div>
    </main>
  );
}
