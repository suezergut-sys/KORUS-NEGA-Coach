import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normalizeTrainingTier } from "@/lib/training-quota";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Недостаточно прав." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Некорректный пользователь." }, { status: 400 });

  try {
    const body = await request.json() as { trainingTier?: unknown };
    if (body.trainingTier !== "standard" && body.trainingTier !== "premium") {
      return Response.json({ error: "Некорректный статус тренировок." }, { status: 400 });
    }
    const trainingTier = normalizeTrainingTier(body.trainingTier);
    const { data, error } = await getSupabaseAdmin()
      .from("user_profiles")
      .update({ training_tier: trainingTier, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,training_tier")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return Response.json({ error: "Пользователь не найден." }, { status: 404 });
    revalidatePath("/admin/users");
    revalidatePath("/");
    return Response.json({ user: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось изменить статус пользователя." }, { status: 500 });
  }
}
