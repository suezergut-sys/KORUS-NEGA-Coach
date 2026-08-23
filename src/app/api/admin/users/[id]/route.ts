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
    const body = await request.json() as { trainingTier?: unknown; departmentId?: unknown };
    const updates: { training_tier?: string; department_id?: string | null; updated_at: string } = { updated_at: new Date().toISOString() };
    if (body.trainingTier !== undefined) {
      if (body.trainingTier !== "standard" && body.trainingTier !== "premium") {
        return Response.json({ error: "Некорректный статус тренировок." }, { status: 400 });
      }
      updates.training_tier = normalizeTrainingTier(body.trainingTier);
    } else if (body.departmentId === null || body.departmentId === "") {
      updates.department_id = null;
    } else if (typeof body.departmentId === "string" && UUID.test(body.departmentId)) {
      const { data: department, error: departmentError } = await getSupabaseAdmin()
        .from("departments")
        .select("id")
        .eq("id", body.departmentId)
        .maybeSingle();
      if (departmentError) throw new Error(departmentError.message);
      if (!department) return Response.json({ error: "Департамент не найден." }, { status: 400 });
      updates.department_id = body.departmentId;
    } else {
      return Response.json({ error: "Некорректный департамент." }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("user_profiles")
      .update(updates)
      .eq("id", id)
      .select("id,training_tier,department_id")
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
