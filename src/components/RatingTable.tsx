"use client";
import Link from "next/link";
import type { RatingPage, RatingSort } from "@/lib/user-stats";

function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value)) : "—"; }

export default function RatingTable({ users, page, pageSize, total, sort, descending }: RatingPage) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortHref = (key: RatingSort) => `/rating?sort=${key}&direction=${sort === key && descending ? "asc" : "desc"}&page=1`;
  const label = (key: RatingSort, text: string) => <Link href={sortHref(key)}>{text} {sort === key ? (descending ? "↓" : "↑") : "↕"}</Link>;
  return (
    <div className="rating-table-wrap neon-panel">
      <table className="rating-table">
        <thead><tr><th>Имя Фамилия</th><th>{label("played", "Поединки")}</th><th>{label("wins", "Победы")}</th><th>{label("winRate", "% побед")}</th><th>{label("averageScore", "Средний балл")}</th><th>Кейсы</th><th>Последний поединок</th></tr></thead>
        <tbody>{users.map((user, index) => <tr key={user.id}><td><span className="rating-place">{(page - 1) * pageSize + index + 1}</span><strong>{user.name}</strong></td><td>{user.played}</td><td>{user.wins}</td><td><span className="win-rate">{user.winRate}%</span></td><td><span className="average-score">{user.averageScore ?? "—"}</span></td><td><div className="rating-cases">{user.cases.length ? user.cases.map((item) => item.playable && item.id ? <Link key={`${item.id}-${item.name}`} href={`/?case=${item.id}`}>{item.private ? "🔒 " : ""}{item.name}</Link> : <span key={`${item.id}-${item.name}`} title={item.private ? "Приватный кейс доступен только владельцу" : "Кейс больше недоступен"}>{item.private ? "🔒 " : ""}{item.name}</span>) : "—"}</div></td><td>{shortDate(user.lastDuel)}</td></tr>)}</tbody>
      </table>
      {!users.length && <p className="empty-rating">В рейтинге пока нет участников.</p>}
      {totalPages > 1 && <nav className="rating-pagination" aria-label="Страницы рейтинга">
        {page > 1 && <Link href={`/rating?sort=${sort}&direction=${descending ? "desc" : "asc"}&page=${page - 1}`}>← Назад</Link>}
        <span>Страница {page} из {totalPages}</span>
        {page < totalPages && <Link href={`/rating?sort=${sort}&direction=${descending ? "desc" : "asc"}&page=${page + 1}`}>Далее →</Link>}
      </nav>}
    </div>
  );
}
