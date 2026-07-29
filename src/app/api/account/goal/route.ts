import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function PUT(request: Request) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const goal = {
      user_id: user.userId,
      focus_skill: text(body.focusSkill, 160),
      goal_text: text(body.goalText, 1000),
      next_session_target: text(body.nextSessionTarget, 1000),
      updated_at: new Date().toISOString(),
    };
    if (!goal.goal_text && !goal.next_session_target) {
      return Response.json({ error: "Укажите цель или фокус следующей тренировки." }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("user_learning_goals")
      .upsert(goal, { onConflict: "user_id" })
      .select("focus_skill,goal_text,next_session_target,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ goal: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить цель." }, { status: 500 });
  }
}
