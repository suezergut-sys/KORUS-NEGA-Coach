import UserSidebar from "@/components/UserSidebar";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserDashboard } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

function fullDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)); }

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
      </div>
    </main>
  );
}
