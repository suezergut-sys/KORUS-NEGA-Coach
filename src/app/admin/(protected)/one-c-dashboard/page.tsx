import { formatAdminDate } from "@/lib/admin-activity";
import { formatAdminAverageScore, type AdminOneCDashboardRow } from "@/lib/admin-one-c-dashboard";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export default async function AdminOneCDashboardPage() {
  const { data, error } = await getSupabaseAdmin().rpc("admin_one_c_dashboard");
  if (error) throw new Error(`Не удалось загрузить дашборд 1С: ${error.message}`);
  const users = (data || []) as AdminOneCDashboardRow[];

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="admin-eyebrow">АКТИВНОСТЬ ДЕПАРТАМЕНТА</span>
          <h1>Дашборд 1С</h1>
          <p>Сотрудники с признаком 1С отсортированы по фамилии. Средний балл считается по первой оценке всех завершённых поединков.</p>
        </div>
      </header>
      <div className="admin-data-table-wrap">
        <table className="admin-data-table one-c-dashboard-table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Дата регистрации</th>
              <th>Дата последнего входа</th>
              <th>Дата последнего отыгранного кейса</th>
              <th>Кол-во сыгранных кейсов с даты регистрации</th>
              <th>Средний балл по всем отыгранным кейсам</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.last_name} {user.first_name}</strong></td>
                <td>{formatAdminDate(user.registered_at)}</td>
                <td>{formatAdminDate(user.last_login_at)}</td>
                <td>{formatAdminDate(user.last_case_played_at)}</td>
                <td className="one-c-dashboard-number">{user.played_cases}</td>
                <td className="one-c-dashboard-score"><strong>{formatAdminAverageScore(user.average_score)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <div className="admin-empty">Пользователей с признаком 1С пока нет.</div>}
      </div>
    </>
  );
}
