import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin();
  const [atoms, chunks, sessions, source, cases] = await Promise.all([
    supabase.from("method_atoms").select("verification_status", { count: "exact" }),
    supabase.from("document_chunks").select("id", { count: "exact", head: true }),
    supabase.from("training_sessions").select("id", { count: "exact", head: true }),
    supabase.from("method_sources").select("code,title,methodology_version,verification_status").in("code", ["SRC-001", "SRC-002"]).order("code"),
    supabase.from("negotiation_cases").select("id", { count: "exact", head: true }),
  ]);
  const statuses = atoms.data || [];
  const verified = statuses.filter((item) => item.verification_status === "verified").length;
  const rejected = statuses.filter((item) => item.verification_status === "rejected").length;
  const candidate = statuses.length - verified - rejected;

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">НАСТРОЙКИ ПРИЛОЖЕНИЯ</span><h1>Админ-панель KORUS NEGA AI 2.0</h1><p>Состояние методической базы и инструментов тренажёра.</p></div>
        <Link className="admin-primary-link" href="/admin/methodology">ПРОВЕРИТЬ МЕТОДОЛОГИЮ →</Link>
      </header>
      <section className="admin-metrics">
        <article><span>Фрагменты методологий</span><strong>{chunks.count || 0}</strong><small>с embeddings</small></article>
        <article><span>Ожидают проверки</span><strong>{candidate}</strong><small>кандидатов</small></article>
        <article><span>Подтверждено</span><strong>{verified}</strong><small>атомов</small></article>
        <article><span>Тренировки</span><strong>{sessions.count || 0}</strong><small>сохранено</small></article>
      </section>
      <section className="admin-dashboard-grid">
        <article className="admin-panel-card">
          <span className="admin-card-icon">▤</span><div><h2>База кейсов</h2><p>Загруженные и сгенерированные кейсы, готовность комиксов по ролям, статистика отыгрышей и полное редактирование.</p><small>{cases.count || 0} кейсов в реестре</small></div>
          <Link href="/admin/cases">Открыть базу кейсов</Link>
        </article>
        <article className="admin-panel-card">
          <span className="admin-card-icon">▤</span><div><h2>Верификация методологии</h2><p>Выберите методологию, просмотрите цитату в контексте источника, исправьте интерпретацию и примите решение по каждому атому.</p><div className="admin-progress"><i style={{ width: `${statuses.length ? ((verified + rejected) / statuses.length) * 100 : 0}%` }} /></div><small>{verified + rejected} из {statuses.length} обработано</small></div>
          <Link href="/admin/methodology">Открыть проверку</Link>
        </article>
        <article className="admin-panel-card muted">
          <span className="admin-card-icon">◎</span><div><h2>Версии методологий</h2>{(source.data || []).map((item) => <p key={item.code}>{item.methodology_version} <small>· {item.verification_status === "verified" ? "верифицирована" : "предварительная"}</small></p>)}</div>
        </article>
        <article className="admin-panel-card muted">
          <span className="admin-card-icon">×</span><div><h2>Отклонено</h2><p>{rejected} методических атомов</p><small>Не участвуют в оценке переговоров</small></div>
        </article>
      </section>
    </>
  );
}
