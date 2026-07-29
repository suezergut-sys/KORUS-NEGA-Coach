import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

const STATUSES = new Set(["pending", "completed", "skipped"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json() as { status?: unknown };
    const status = typeof body.status === "string" ? body.status : "";
    if (!STATUSES.has(status)) return Response.json({ error: "Некорректный статус задания." }, { status: 400 });
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("practice_tasks")
      .update({ status, completed_at: status === "completed" ? now : null, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.userId)
      .select("id,status,completed_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ task: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить задание." }, { status: 500 });
  }
}
