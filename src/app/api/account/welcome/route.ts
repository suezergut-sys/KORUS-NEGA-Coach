import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserDashboard } from "@/lib/user-stats";
import { getDailyTrainingQuota } from "@/lib/training-quota-server";

export async function GET() {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const [dashboard, trainingQuota] = await Promise.all([
      getUserDashboard(session.userId),
      getDailyTrainingQuota(session.userId, session.email),
    ]);
    return Response.json({
      firstName: dashboard.profile.first_name,
      loginCount: dashboard.loginCount,
      played: dashboard.played,
      winRate: dashboard.winRate,
      averageScore: dashboard.averageScore,
      trainingQuota,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить статистику." }, { status: 500 });
  }
}
