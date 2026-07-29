import RatingTable from "@/components/RatingTable";
import UserSidebar from "@/components/UserSidebar";
import { getRating } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

export default async function RatingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedSort = typeof query.sort === "string" ? query.sort : undefined;
  const rating = await getRating({
    page: Number(typeof query.page === "string" ? query.page : 1),
    sort: requestedSort === "wins" || requestedSort === "winRate" || requestedSort === "averageScore"
      ? requestedSort
      : "played",
    descending: query.direction !== "asc",
  });
  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main rating-page">
        <header className="admin-page-header"><div><span className="admin-eyebrow">ОБЩИЙ РЕЙТИНГ</span><h1>Рейтинг участников</h1><p>Сравните результаты и средний балл за последние 10 поединков. Названия приватных кейсов видит только их владелец; для остальных участников они обезличены.</p></div></header>
        <RatingTable {...rating} />
      </div>
    </main>
  );
}
