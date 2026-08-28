import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_ACTIVITY_LABELS, ADMIN_LOG_PAGE_SIZE, formatAdminDate, parseAdminLogPage } from "@/lib/admin-activity";
import type { UserActivityType } from "@/lib/user-activity-format";
import { getSupabaseAdmin } from "@/lib/supabase-server";

type ActivityRow = {
  id: string;
  user_name: string;
  event_type: UserActivityType;
  subject_title: string | null;
  occurred_at: string;
};

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = parseAdminLogPage((await searchParams).page);
  const from = (page - 1) * ADMIN_LOG_PAGE_SIZE;
  const { data, error, count } = await getSupabaseAdmin()
    .from("user_activity_events")
    .select("id,user_name,event_type,subject_title,occurred_at", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(from, from + ADMIN_LOG_PAGE_SIZE - 1);
  if (error) throw new Error(`Не удалось загрузить логи: ${error.message}`);
  const events = (data || []) as ActivityRow[];
  const totalPages = Math.max(1, Math.ceil((count || 0) / ADMIN_LOG_PAGE_SIZE));
  if (page > totalPages) redirect(`/admin/logs?page=${totalPages}`);

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">АКТИВНОСТЬ УЧАСТНИКОВ</span><h1>Логи</h1><p>Все ключевые действия пользователей, по 50 событий на странице.</p></div>
      </header>
      <section className="admin-activity-list" aria-label="Логи действий пользователей">
        {events.map((event) => (
          <article key={event.id}>
            <time dateTime={event.occurred_at}>{formatAdminDate(event.occurred_at)}</time>
            <div><strong>{event.user_name}</strong><span>{ADMIN_ACTIVITY_LABELS[event.event_type] || event.event_type}</span>{event.subject_title && <small>{event.subject_title}</small>}</div>
          </article>
        ))}
        {!events.length && <div className="admin-empty">Действий на этой странице нет.</div>}
      </section>
      <nav className="admin-pagination" aria-label="Страницы логов">
        {page > 1 ? <Link href={`/admin/logs?page=${page - 1}`} prefetch={false}>← Предыдущая</Link> : <span />}
        <strong>Страница {page} из {totalPages}</strong>
        {page < totalPages ? <Link href={`/admin/logs?page=${page + 1}`} prefetch={false}>Следующая →</Link> : <span />}
      </nav>
    </>
  );
}
