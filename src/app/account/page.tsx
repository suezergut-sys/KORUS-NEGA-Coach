import UserSidebar from "@/components/UserSidebar";
import OnboardingLauncher from "@/components/OnboardingLauncher";
import LearningPlan from "@/components/LearningPlan";
import Link from "next/link";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserDashboard } from "@/lib/user-stats";
import PrivacyControls from "@/components/PrivacyControls";

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
          <article><span>СРЕДНИЙ БАЛЛ</span><strong>{dashboard.averageScore ?? "—"}</strong><small>последние 10 рейтинговых попыток</small></article>
        </section>
        <section className="skill-progress-card neon-panel">
          <header><div><span className="admin-eyebrow">КАРТА НАВЫКОВ</span><h2>Динамика по единой рубрике</h2></div><p>Каждый критерий оценивается по шкале от 0 до 20</p></header>
          <div>{dashboard.skillProgress.map((skill) => (
            <article key={skill.id}>
              <header><strong>{skill.label}</strong><span>{skill.latest} / 20</span></header>
              <i><b style={{ width: `${skill.latest * 5}%` }} /></i>
              <p>Среднее: {skill.average} · попыток: {skill.attempts}{skill.delta !== null ? ` · изменение: ${skill.delta > 0 ? "+" : ""}${skill.delta}` : ""}</p>
            </article>
          ))}</div>
          {!dashboard.skillProgress.length && <div className="dashboard-empty">Карта навыков появится после первого анализа по новой рубрике.</div>}
        </section>
        <LearningPlan initialGoal={dashboard.learningGoal} initialTasks={dashboard.tasks} skills={dashboard.skillProgress} />
        <PrivacyControls
          initialConsent={Boolean(dashboard.profile.transcript_consent_at)}
          initialRetentionDays={dashboard.profile.transcript_retention_days || 365}
        />
        <section className="account-help-card neon-panel">
          <div><span className="admin-eyebrow">ПОМОЩЬ</span><h2>Знакомство с сервисом</h2><p>Вернитесь к подсказкам по навигации, настройке кейса и запуску переговоров.</p></div>
          <OnboardingLauncher />
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
              <tbody>{dashboard.history.map((duel) => <tr key={duel.id}><td>{historyDate(duel.endedAt)}</td><td><Link href={`/account/sessions/${duel.id}`}><strong>{duel.caseName}</strong></Link>{!duel.ranked && <small>нерейтинговый</small>}</td><td>{duel.participantRole}</td><td><span className={`duel-result ${duel.result === "Победа" ? "win" : duel.result === "Поражение" ? "loss" : "draw"}`}>{duel.status === "analysis_failed" ? "Нужен повтор" : duel.result}</span></td><td><b className="duel-score">{duel.score ?? "—"}</b></td></tr>)}</tbody>
            </table>
          </div>
          {!dashboard.history.length && <div className="dashboard-empty">История появится после первого завершённого поединка.</div>}
        </section>
      </div>
    </main>
  );
}
