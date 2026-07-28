import AdminFeedbackTable, { type AdminFeedbackItem } from "@/components/AdminFeedbackTable";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export default async function AdminFeedbackPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("user_feedback")
    .select("id,author_name,author_email,section_label,content,processed,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const items: AdminFeedbackItem[] = (data || []).map((item) => ({
    id: item.id,
    authorName: item.author_name,
    authorEmail: item.author_email,
    sectionLabel: item.section_label,
    content: item.content,
    processed: item.processed,
    createdAt: item.created_at,
  }));

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="admin-eyebrow">ОБРАЩЕНИЯ ПОЛЬЗОВАТЕЛЕЙ</span>
          <h1>Обратная связь</h1>
          <p>Новые обращения сверху. Отметка «Отработано» выставляется администратором вручную.</p>
        </div>
      </header>
      <section className="admin-feedback-summary">
        <article><span>Всего обращений</span><strong>{items.length}</strong></article>
        <article><span>Ожидают обработки</span><strong>{items.filter((item) => !item.processed).length}</strong></article>
        <article><span>Отработано</span><strong>{items.filter((item) => item.processed).length}</strong></article>
      </section>
      <AdminFeedbackTable initialItems={items} />
    </>
  );
}
