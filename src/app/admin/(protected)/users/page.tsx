import { formatAdminDate } from "@/lib/admin-activity";
import { isPlatformAdministrator, platformRoleLabel } from "@/lib/admin-access";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import AdminUserTrainingTierSelect from "@/components/AdminUserTrainingTierSelect";
import AdminUserDepartmentSelect from "@/components/AdminUserDepartmentSelect";
import { normalizeTrainingTier } from "@/lib/training-quota";

type AdminUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  training_tier: string;
  department_id: string | null;
  created_at: string;
  last_activity_at: string | null;
};

export default async function AdminUsersPage() {
  const db = getSupabaseAdmin();
  const [{ data, error }, { data: departmentRows, error: departmentsError }] = await Promise.all([
    db.rpc("admin_user_overview"),
    db.from("departments").select("id,name").order("name"),
  ]);
  if (error) throw new Error(`Не удалось загрузить пользователей: ${error.message}`);
  if (departmentsError) throw new Error(`Не удалось загрузить департаменты: ${departmentsError.message}`);
  const users = (data || []) as AdminUserRow[];
  const departments = (departmentRows || []) as Array<{ id: string; name: string }>;

  return (
    <>
      <header className="admin-page-header">
        <div><span className="admin-eyebrow">УЧАСТНИКИ ПЛАТФОРМЫ</span><h1>Пользователи</h1><p>Список отсортирован от новых регистраций к более ранним.</p></div>
      </header>
      <div className="admin-data-table-wrap">
        <table className="admin-data-table">
          <thead><tr><th>ФИО</th><th>Роль</th><th>Статус</th><th>Департамент</th><th>Дата регистрации</th><th>Электронная почта</th><th>Дата последней активности</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.last_name} {user.first_name}</strong></td>
                <td><span className={`admin-user-role ${isPlatformAdministrator(user.email) ? "administrator" : "user"}`}>{platformRoleLabel(user.email)}</span></td>
                <td>
                  {isPlatformAdministrator(user.email)
                    ? <span className="admin-user-role administrator">Без лимита</span>
                    : <AdminUserTrainingTierSelect userId={user.id} userName={`${user.first_name} ${user.last_name}`} initialTier={normalizeTrainingTier(user.training_tier)} />}
                </td>
                <td><AdminUserDepartmentSelect userId={user.id} userName={`${user.first_name} ${user.last_name}`} initialDepartmentId={user.department_id} departments={departments} /></td>
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
