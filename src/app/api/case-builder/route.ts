import { getWorkspaceView } from "@/lib/case-db";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const workspaceId = new URL(request.url).searchParams.get("workspaceId");
    if (!workspaceId) return Response.json({ error: "Не указан черновик кейса." }, { status: 400 });
    return Response.json({ workspace: await getWorkspaceView(workspaceId, session.userId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось открыть черновик." }, { status: 500 });
  }
}
