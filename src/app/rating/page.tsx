import RatingTable from "@/components/RatingTable";
import UserSidebar from "@/components/UserSidebar";
import { getRating } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

export default async function RatingPage() {
  const users = await getRating();
  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main rating-page">
        <header className="admin-page-header"><div><span className="admin-eyebrow">ОБЩИЙ РЕЙТИНГ</span><h1>Рейтинг участников</h1><p>Сравните результаты и средний балл за последние 10 поединков. Учитываются общедоступные и приватные кейсы; приватный кейс виден по названию, но открыть его может только владелец.</p></div></header>
        <RatingTable users={users} />
      </div>
    </main>
  );
}
