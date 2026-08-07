import { formatAdminDate } from "@/lib/admin-activity";
import { getSupabaseAdmin } from "@/lib/supabase-server";

type AdminUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  last_activity_at: string | null;
};

export default async function AdminUsersPage() {
  const { data, error } = await getSupabaseAdmin().rpc("admin_user_overview");
  if (error) throw new Error(`Не удалось загрузить пользователей: ${error.message}`);
  const users = (data || []) as AdminUserRow[];

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">УЧАСТНИКИ ПЛАТФОРМЫ</span><h1>Пользователи</h1><p>Список отсортирован от новых регистраций к более ранним.</p></div>
      </header>
      <div className="admin-data-table-wrap">
        <table className="admin-data-table">
          <thead><tr><th>ФИО</th><th>Дата регистрации</th><th>Электронная почта</th><th>Дата последней активности</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.last_name} {user.first_name}</strong></td>
                <td>{formatAdminDate(user.created_at)}</td>
                <td><a href={`mailto:${user.email}`}>{user.email}</a></td>
                <td>{formatAdminDate(user.last_activity_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <div className="admin-empty">Зарегистрированных пользователей пока нет.</div>}
      </div>
    </>
  );
}
