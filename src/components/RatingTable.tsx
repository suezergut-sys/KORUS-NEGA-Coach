"use client";
import { useMemo, useState } from "react";
import type { UserStanding } from "@/lib/user-stats";

type SortKey = "played" | "wins" | "winRate" | "averageScore";
function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value)) : "—"; }

export default function RatingTable({ users }: { users: UserStanding[] }) {
  const [sort, setSort] = useState<SortKey>("played");
  const [descending, setDescending] = useState(true);
  const sorted = useMemo(() => [...users].sort((a, b) => {
    const left = a[sort] ?? -1;
    const right = b[sort] ?? -1;
    return (descending ? right - left : left - right) || a.name.localeCompare(b.name, "ru");
  }), [users, sort, descending]);
  function choose(key: SortKey) { if (key === sort) setDescending((value) => !value); else { setSort(key); setDescending(true); } }
  const label = (key: SortKey, text: string) => <button onClick={() => choose(key)}>{text} {sort === key ? (descending ? "↓" : "↑") : "↕"}</button>;
  return (
    <div className="rating-table-wrap neon-panel">
      <table className="rating-table">
        <thead><tr><th>Имя Фамилия</th><th>{label("played", "Поединки")}</th><th>{label("wins", "Победы")}</th><th>{label("winRate", "% побед")}</th><th>{label("averageScore", "Средний балл")}</th><th>Последний поединок</th></tr></thead>
        <tbody>{sorted.map((user, index) => <tr key={user.id}><td><span className="rating-place">{index + 1}</span><strong>{user.name}</strong></td><td>{user.played}</td><td>{user.wins}</td><td><span className="win-rate">{user.winRate}%</span></td><td><span className="average-score">{user.averageScore ?? "—"}</span></td><td>{shortDate(user.lastDuel)}</td></tr>)}</tbody>
      </table>
      {!users.length && <p className="empty-rating">В рейтинге пока нет участников.</p>}
    </div>
  );
}
