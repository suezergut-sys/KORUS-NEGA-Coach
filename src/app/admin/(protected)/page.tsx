import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin();
  const [atoms, chunks, sessions, source] = await Promise.all([
    supabase.from("method_atoms").select("verification_status", { count: "exact" }),
    supabase.from("document_chunks").select("id", { count: "exact", head: true }),
    supabase.from("training_sessions").select("id", { count: "exact", head: true }),
    supabase.from("method_sources").select("methodology_version,verification_status").eq("code", "SRC-001").single(),
  ]);
  const statuses = atoms.data || [];
  const verified = statuses.filter((item) => item.verification_status === "verified").length;
  const rejected = statuses.filter((item) => item.verification_status === "rejected").length;
  const candidate = statuses.length - verified - rejected;

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">НАСТРОЙКИ ПРИЛОЖЕНИЯ</span><h1>Админ-панель KORUS NEGA AI</h1><p>Состояние методической базы и инструментов тренажёра.</p></div>
        <Link className="admin-primary-link" href="/admin/methodology">ПРОВЕРИТЬ МЕТОДОЛОГИЮ →</Link>
      </header>
      <section className="admin-metrics">
        <article><span>Фрагменты книги</span><strong>{chunks.count || 0}</strong><small>с embeddings</small></article>
        <article><span>Ожидают проверки</span><strong>{candidate}</strong><small>кандидатов</small></article>
        <article><span>Подтверждено</span><strong>{verified}</strong><small>атомов</small></article>
        <article><span>Тренировки</span><strong>{sessions.count || 0}</strong><small>сохранено</small></article>
      </section>
      <section className="admin-dashboard-grid">
        <article className="admin-panel-card">
          <span className="admin-card-icon">▤</span><div><h2>Верификация методологии</h2><p>Просмотрите цитату в контексте книги, исправьте интерпретацию и примите решение по каждому атому.</p><div className="admin-progress"><i style={{ width: `${statuses.length ? ((verified + rejected) / statuses.length) * 100 : 0}%` }} /></div><small>{verified + rejected} из {statuses.length} обработано</small></div>
          <Link href="/admin/methodology">Открыть проверку</Link>
        </article>
        <article className="admin-panel-card muted">
          <span className="admin-card-icon">◎</span><div><h2>Текущая версия</h2><p>{source.data?.methodology_version || "tarasov-v0-candidate"}</p><small>Статус: {source.data?.verification_status === "verified" ? "верифицирована" : "предварительная"}</small></div>
        </article>
        <article className="admin-panel-card muted">
          <span className="admin-card-icon">×</span><div><h2>Отклонено</h2><p>{rejected} методических атомов</p><small>Не участвуют в оценке переговоров</small></div>
        </article>
      </section>
    </>
  );
}
