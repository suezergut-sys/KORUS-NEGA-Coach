import Link from "next/link";

export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell case-builder-shell">
      <aside className="admin-sidebar">
        <Link className="admin-logo" href="/"><strong>K</strong><span>KORUS NEGA AI<small>КЕЙСЫ</small></span></Link>
        <nav aria-label="Раздел кейсов">
          <Link href="/">⌂ <span>Переговоры</span></Link>
          <Link href="/cases">＋ <span>Создать кейс</span></Link>
          <Link href="/admin">⚙ <span>Админ-панель</span></Link>
        </nav>
        <form action="/api/site/logout" method="post"><button type="submit">⇥ <span>Выйти с сайта</span></button></form>
      </aside>
      <div className="admin-main">{children}</div>
    </main>
  );
}
