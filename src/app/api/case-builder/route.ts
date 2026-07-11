import { getWorkspaceView } from "@/lib/case-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const workspaceId = new URL(request.url).searchParams.get("workspaceId");
    if (!workspaceId) return Response.json({ error: "Не указан черновик кейса." }, { status: 400 });
    return Response.json({ workspace: await getWorkspaceView(workspaceId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось открыть черновик." }, { status: 500 });
  }
}
