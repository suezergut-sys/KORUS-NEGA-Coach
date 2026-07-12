import UserSidebar from "@/components/UserSidebar";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserDashboard } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

function fullDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)); }
function historyDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }

export default async function AccountPage() {
  const session = await getCurrentUserSession();
  if (!session) return null;
  const dashboard = await getUserDashboard(session.userId);
  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main user-dashboard">
        <header className="admin-page-header"><div><span className="admin-eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>{dashboard.profile.first_name} {dashboard.profile.last_name}</h1><p>Участник с {fullDate(dashboard.profile.created_at)}</p></div></header>
        <section className="user-metrics">
          <article><span>СЫГРАНО ПОЕДИНКОВ</span><strong>{dashboard.played}</strong><small>всего тренировок</small></article>
          <article><span>ПОБЕДЫ</span><strong>{dashboard.winRate}%</strong><small>{dashboard.wins} выигранных поединков</small></article>
          <article><span>ПОСЛЕДНИЙ ПОЕДИНОК</span><strong className="metric-date">{dashboard.lastDuel ? fullDate(dashboard.lastDuel) : "—"}</strong><small>{dashboard.lastDuel ? "последняя активность" : "начните первую тренировку"}</small></article>
        </section>
        <section className="top-cases-card neon-panel">
          <header><div><span className="admin-eyebrow">ПЕРСОНАЛЬНАЯ СТАТИСТИКА</span><h2>Топ-3 кейсов</h2></div><p>Кейсы, которые вы отыгрывали чаще всего</p></header>
          <div className="top-cases-list">{dashboard.topCases.map((item, index) => <article key={item.name}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><div><b>{item.count}</b><small>поединков</small></div></article>)}</div>
          {!dashboard.topCases.length && <div className="dashboard-empty">Здесь появятся ваши любимые кейсы после первого завершённого поединка.</div>}
        </section>
        <section className="duel-history-card neon-panel">
          <header><div><span className="admin-eyebrow">ИСТОРИЯ ПОЕДИНКОВ</span><h2>Все тренировки</h2></div><p>Результаты и оценки завершённых переговоров</p></header>
          <div className="duel-history-wrap">
            <table className="duel-history-table">
              <thead><tr><th>Дата</th><th>Кейс</th><th>В какой роли</th><th>Результат</th><th>Баллы из 100</th></tr></thead>
              <tbody>{dashboard.history.map((duel) => <tr key={duel.id}><td>{historyDate(duel.endedAt)}</td><td><strong>{duel.caseName}</strong></td><td>{duel.participantRole}</td><td><span className={`duel-result ${duel.result === "Победа" ? "win" : duel.result === "Поражение" ? "loss" : "draw"}`}>{duel.result}</span></td><td><b className="duel-score">{duel.score ?? "—"}</b></td></tr>)}</tbody>
            </table>
          </div>
          {!dashboard.history.length && <div className="dashboard-empty">История появится после первого завершённого поединка.</div>}
        </section>
      </div>
    </main>
  );
}
