import Link from "next/link";
import AdminCaseList, { type AdminCaseListItem } from "@/components/AdminCaseList";
import type { CaseRole } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export default async function AdminCasesPage() {
  const db = getSupabaseAdmin();
  const [{ data: cases, error }, { data: sessions }, { data: jobs }] = await Promise.all([
    db.from("negotiation_cases").select("id,title,user_role,opponent_role,additional_roles,origin,status,created_by,created_at").order("created_at", { ascending: false }).limit(500),
    db.from("training_sessions").select("case_id").not("case_id", "is", null).limit(10000),
    db.from("case_media_jobs").select("case_id,status,published_generation_id"),
  ]);
  if (error) throw new Error(error.message);
  const playCounts = new Map<string, number>();
  for (const session of sessions || []) playCounts.set(session.case_id, (playCounts.get(session.case_id) || 0) + 1);
  const jobMap = new Map((jobs || []).map((job) => [job.case_id, job]));
  const generationIds = (jobs || []).map((job) => job.published_generation_id).filter(Boolean);
  const { data: panels } = generationIds.length
    ? await db.from("case_comic_panels").select("case_id,generation_id,role_index").in("generation_id", generationIds)
    : { data: [] };
  const readyRoles = new Map<string, Map<number, number>>();
  for (const panel of panels || []) {
    const key = `${panel.case_id}:${panel.generation_id}`;
    if (!readyRoles.has(key)) readyRoles.set(key, new Map());
    const counts = readyRoles.get(key);
    counts?.set(panel.role_index, (counts.get(panel.role_index) || 0) + 1);
  }
  const items: AdminCaseListItem[] = (cases || []).map((item) => {
    const roles = [item.user_role, item.opponent_role, ...(item.additional_roles || [])] as CaseRole[];
    const job = jobMap.get(item.id);
    const ready = readyRoles.get(`${item.id}:${job?.published_generation_id}`) || new Map<number, number>();
    return {
      id: item.id,
      title: item.title,
      createdAt: item.created_at,
      createdBy: item.created_by || (item.origin === "seed" ? "Системный кейс" : "Источник не указан"),
      origin: item.origin,
      status: item.status,
      plays: playCounts.get(item.id) || 0,
      mediaStatus: job?.status || "missing",
      roleStatuses: roles.map((role, index) => ({ name: role.name, ready: (ready.get(index) || 0) >= 4 })),
    };
  });

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">БИБЛИОТЕКА ТРЕНАЖЁРА</span><h1>Управление базой кейсов</h1><p>Публикация, готовность комиксов для всех ролей и статистика использования.</p></div>
        <Link className="admin-primary-link" href="/cases">＋ СОЗДАТЬ КЕЙС</Link>
      </header>
      <section className="admin-case-summary">
        <article><span>Всего кейсов</span><strong>{items.length}</strong></article>
        <article><span>Опубликовано</span><strong>{items.filter((item) => item.status === "published").length}</strong></article>
        <article><span>Комиксы готовы</span><strong>{items.filter((item) => item.roleStatuses.length > 0 && item.roleStatuses.every((role) => role.ready)).length}</strong></article>
        <article><span>Всего отыгрышей</span><strong>{items.reduce((sum, item) => sum + item.plays, 0)}</strong></article>
      </section>
      <AdminCaseList initialCases={items} />
    </>
  );
}
