import Link from "next/link";
import { notFound } from "next/navigation";
import NegotiationReport from "@/components/NegotiationReport";
import AnalysisRetryButton from "@/components/AnalysisRetryButton";
import UserSidebar from "@/components/UserSidebar";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserSessionReport } from "@/lib/user-stats";
import type { MethodologyId } from "@/lib/methodologies";

export const dynamic = "force-dynamic";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function SessionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserSession();
  if (!user) return null;
  const { id } = await params;
  const report = await getUserSessionReport(user.userId, id);
  if (!report) notFound();
  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main session-report-page">
        <header className="admin-page-header">
          <div><span className="admin-eyebrow">ИСТОРИЯ ТРЕНИРОВОК</span><h1>{report.caseName}</h1><p>{dateTime(report.session.ended_at)} · роль {report.session.participant_role_name} · {report.session.duration_seconds} сек.</p></div>
          <Link className="admin-header-link" href="/account">← Вернуться в кабинет</Link>
        </header>
        {report.metrics && (
          <section className="session-technical-metrics">
            <article><span>ПОДКЛЮЧЕНИЕ</span><strong>{report.metrics.setup_latency_ms || "—"} мс</strong></article>
            <article><span>ОТВЕТ P50</span><strong>{report.metrics.reply_latency_p50_ms || "—"} мс</strong></article>
            <article><span>ОТВЕТ P95</span><strong>{report.metrics.reply_latency_p95_ms || "—"} мс</strong></article>
            <article><span>ВОССТАНОВЛЕНИЯ</span><strong>{report.metrics.recovery_count}</strong></article>
          </section>
        )}
        {report.previous && report.analysis && (
          <section className="attempt-comparison neon-panel">
            <div><span>ПРЕДЫДУЩАЯ ПОПЫТКА</span><strong>{report.previous.score} / 100</strong></div>
            <div><span>ТЕКУЩАЯ ПОПЫТКА</span><strong>{report.analysis.overallScore} / 100</strong></div>
            <div><span>ИЗМЕНЕНИЕ</span><strong>{report.analysis.overallScore - Number(report.previous.score || 0) > 0 ? "+" : ""}{report.analysis.overallScore - Number(report.previous.score || 0)}</strong></div>
          </section>
        )}
        {report.analysis ? (
          <section className="analysis-card session-saved-report">
            <NegotiationReport analysis={report.analysis} methodologyId={(report.session.methodology_id || "tarasov") as MethodologyId} opponentName={report.session.opponent_name} speechAnalytics={report.speechAnalytics} />
          </section>
        ) : (
          <section className="analysis-card"><div className="analysis-error"><strong>Отчёт ещё не готов</strong><p>Стенограмма сохранена и не потеряется при повторном запуске анализа.</p><AnalysisRetryButton sessionId={report.session.id} /></div></section>
        )}
      </div>
    </main>
  );
}
