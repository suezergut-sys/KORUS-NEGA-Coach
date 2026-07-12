import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-server";

type ProfileRow = { id: string; first_name: string; last_name: string; email: string; created_at: string };
type SessionRow = { id: string; user_id: string; case_id: string | null; case_code: string; ended_at: string };
type EvaluationRow = { session_id: string; result: { outcome?: { winner?: string } } | null };

export type UserStanding = {
  id: string; name: string; played: number; wins: number; winRate: number; lastDuel: string | null;
};

function outcomeMap(rows: EvaluationRow[]) {
  return new Map(rows.map((row) => [row.session_id, row.result?.outcome?.winner || ""]));
}

export async function getUserDashboard(userId: string) {
  const supabase = getSupabaseAdmin();
  const [{ data: profile, error: profileError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("user_profiles").select("id, first_name, last_name, email, created_at").eq("id", userId).single<ProfileRow>(),
    supabase.from("training_sessions").select("id, user_id, case_id, case_code, ended_at").eq("user_id", userId).order("ended_at", { ascending: false }),
  ]);
  if (profileError || !profile) throw new Error("Профиль пользователя не найден.");
  if (sessionsError) throw new Error(`Не удалось загрузить статистику: ${sessionsError.message}`);
  const sessionRows = (sessions || []) as SessionRow[];
  const ids = sessionRows.map((item) => item.id);
  const caseIds = [...new Set(sessionRows.map((item) => item.case_id).filter(Boolean))] as string[];
  const [{ data: evaluations }, { data: cases }] = await Promise.all([
    ids.length ? supabase.from("evaluations").select("session_id, result").in("session_id", ids) : Promise.resolve({ data: [] }),
    caseIds.length ? supabase.from("negotiation_cases").select("id, title").in("id", caseIds) : Promise.resolve({ data: [] }),
  ]);
  const outcomes = outcomeMap((evaluations || []) as EvaluationRow[]);
  const wins = sessionRows.filter((item) => outcomes.get(item.id) === "user").length;
  const titles = new Map(((cases || []) as { id: string; title: string }[]).map((item) => [item.id, item.title]));
  const caseCounts = new Map<string, { name: string; count: number }>();
  for (const session of sessionRows) {
    const key = session.case_id || session.case_code;
    const current = caseCounts.get(key);
    caseCounts.set(key, { name: (session.case_id && titles.get(session.case_id)) || session.case_code, count: (current?.count || 0) + 1 });
  }
  return {
    profile,
    played: sessionRows.length,
    wins,
    winRate: sessionRows.length ? Math.round((wins / sessionRows.length) * 100) : 0,
    lastDuel: sessionRows[0]?.ended_at || null,
    topCases: [...caseCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, 3),
  };
}

export async function getRating(): Promise<UserStanding[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: profiles, error: profilesError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("user_profiles").select("id, first_name, last_name, email, created_at").eq("role", "user"),
    supabase.from("training_sessions").select("id, user_id, case_id, case_code, ended_at").not("user_id", "is", null),
  ]);
  if (profilesError || sessionsError) throw new Error("Не удалось сформировать рейтинг пользователей.");
  const sessionRows = (sessions || []) as SessionRow[];
  const ids = sessionRows.map((item) => item.id);
  const { data: evaluations } = ids.length
    ? await supabase.from("evaluations").select("session_id, result").in("session_id", ids)
    : { data: [] };
  const outcomes = outcomeMap((evaluations || []) as EvaluationRow[]);
  return ((profiles || []) as ProfileRow[]).map((profile) => {
    const userSessions = sessionRows.filter((item) => item.user_id === profile.id).sort((a, b) => b.ended_at.localeCompare(a.ended_at));
    const wins = userSessions.filter((item) => outcomes.get(item.id) === "user").length;
    return { id: profile.id, name: `${profile.first_name} ${profile.last_name}`, played: userSessions.length, wins, winRate: userSessions.length ? Math.round((wins / userSessions.length) * 100) : 0, lastDuel: userSessions[0]?.ended_at || null };
  });
}
