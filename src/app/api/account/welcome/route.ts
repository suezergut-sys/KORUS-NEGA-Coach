import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserDashboard } from "@/lib/user-stats";

export async function GET() {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const dashboard = await getUserDashboard(session.userId);
    return Response.json({
      firstName: dashboard.profile.first_name,
      loginCount: dashboard.loginCount,
      played: dashboard.played,
      winRate: dashboard.winRate,
      averageScore: dashboard.averageScore,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить статистику." }, { status: 500 });
  }
}
