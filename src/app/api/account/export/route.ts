import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  const db = getSupabaseAdmin();
  const [
    { data: profile, error: profileError },
    { data: sessions, error: sessionsError },
    { data: learningGoal },
  ] = await Promise.all([
    db.from("user_profiles").select("id,first_name,last_name,email,created_at,transcript_consent_at,transcript_retention_days,data_policy_version").eq("id", user.userId).single(),
    db.from("training_sessions").select("*").eq("user_id", user.userId).order("created_at", { ascending: false }),
    db.from("user_learning_goals").select("*").eq("user_id", user.userId).maybeSingle(),
  ]);
  if (profileError || sessionsError) {
    return Response.json({ error: profileError?.message || sessionsError?.message }, { status: 500 });
  }
  const sessionIds = (sessions || []).map((session) => session.id);
  const [
    { data: turns },
    { data: evaluations },
    { data: metrics },
    { data: practiceTasks },
  ] = sessionIds.length
    ? await Promise.all([
      db.from("turns").select("*").in("session_id", sessionIds).order("sequence"),
      db.from("evaluations").select("*").in("session_id", sessionIds),
      db.from("session_metrics").select("*").in("session_id", sessionIds),
      db.from("practice_tasks").select("*").eq("user_id", user.userId).order("created_at"),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const exportedAt = new Date().toISOString();
  return new Response(JSON.stringify({
    format: "korus-nega-coach-user-data-v1",
    exportedAt,
    profile,
    sessions: sessions || [],
    turns: turns || [],
    evaluations: evaluations || [],
    sessionMetrics: metrics || [],
    learningGoal,
    practiceTasks: practiceTasks || [],
  }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nega-coach-export-${exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
