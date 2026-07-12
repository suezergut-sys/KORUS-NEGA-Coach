import Link from "next/link";

export default function UserSidebar() {
  return (
    <aside className="admin-sidebar user-sidebar">
      <Link className="admin-logo" href="/"><strong>K</strong><span>KORUS NEGA AI<small>МОЙ ПРОГРЕСС</small></span></Link>
      <nav aria-label="Навигация пользователя">
        <Link href="/">◉ <span>Переговоры</span></Link>
        <Link href="/account">♙ <span>Личный кабинет</span></Link>
        <Link href="/rating">▤ <span>Рейтинг</span></Link>
        <Link href="/cases">＋ <span>Создать кейс</span></Link>
      </nav>
      <form action="/api/site/logout" method="post"><button type="submit">⇥ <span>Выйти</span></button></form>
    </aside>
  );
}
