import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { DEFAULT_CASE } from "@/lib/default-case";
import { averageLatestScores } from "@/lib/user-stats-core";

type ProfileRow = { id: string; first_name: string; last_name: string; email: string; created_at: string };
type SessionRow = { id: string; user_id: string; case_id: string | null; case_code: string; participant_role_name: string | null; opponent_name: string; ended_at: string };
type EvaluationRow = { session_id: string; overall_score: number | null; result: { outcome?: { winner?: string } } | null };
type CaseRow = { id: string; title: string; user_role: { name?: string }; opponent_role: { name?: string }; additional_roles: Array<{ name?: string }> | null };

export type DuelHistoryItem = {
  id: string; endedAt: string; caseName: string; participantRole: string; result: "Победа" | "Поражение" | "Ничья" | "Не определён"; score: number | null;
};

export type UserStanding = {
  id: string; name: string; played: number; wins: number; winRate: number; averageScore: number | null; lastDuel: string | null;
};

function evaluationMap(rows: EvaluationRow[]) {
  return new Map(rows.map((row) => [row.session_id, { winner: row.result?.outcome?.winner || "", score: row.overall_score }]));
}

function resultLabel(winner: string): DuelHistoryItem["result"] {
  if (winner === "user") return "Победа";
  if (winner === "opponent") return "Поражение";
  if (winner === "draw") return "Ничья";
  return "Не определён";
}

function caseName(session: SessionRow, cases: Map<string, CaseRow>) {
  if (session.case_id) return cases.get(session.case_id)?.title || session.case_code;
  return session.case_code === DEFAULT_CASE.slug ? DEFAULT_CASE.title : session.case_code;
}

function participantRole(session: SessionRow, cases: Map<string, CaseRow>) {
  if (session.participant_role_name) return session.participant_role_name;
  const negotiationCase = session.case_id ? cases.get(session.case_id) : session.case_code === DEFAULT_CASE.slug ? DEFAULT_CASE : null;
  if (!negotiationCase) return "Не сохранена";
  const roles = "additional_roles" in negotiationCase
    ? [negotiationCase.user_role, negotiationCase.opponent_role, ...(negotiationCase.additional_roles || [])]
    : [negotiationCase.userRole, negotiationCase.opponentRole, ...negotiationCase.additionalRoles];
  const candidates = roles.map((role) => role.name || "").filter((name) => name && name !== session.opponent_name);
  return candidates.length === 1 ? candidates[0] : "Не сохранена";
}

export async function getUserDashboard(userId: string) {
  const supabase = getSupabaseAdmin();
  const [{ data: profile, error: profileError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("user_profiles").select("id, first_name, last_name, email, created_at").eq("id", userId).single<ProfileRow>(),
    supabase.from("training_sessions").select("id, user_id, case_id, case_code, participant_role_name, opponent_name, ended_at").eq("user_id", userId).order("ended_at", { ascending: false }),
  ]);
  if (profileError || !profile) throw new Error("Профиль пользователя не найден.");
  if (sessionsError) throw new Error(`Не удалось загрузить статистику: ${sessionsError.message}`);
  const sessionRows = (sessions || []) as SessionRow[];
  const ids = sessionRows.map((item) => item.id);
  const caseIds = [...new Set(sessionRows.map((item) => item.case_id).filter(Boolean))] as string[];
  const [{ data: evaluations }, { data: cases }] = await Promise.all([
    ids.length ? supabase.from("evaluations").select("session_id, overall_score, result").in("session_id", ids) : Promise.resolve({ data: [] }),
    caseIds.length ? supabase.from("negotiation_cases").select("id, title, user_role, opponent_role, additional_roles").in("id", caseIds) : Promise.resolve({ data: [] }),
  ]);
  const evaluationBySession = evaluationMap((evaluations || []) as EvaluationRow[]);
  const wins = sessionRows.filter((item) => evaluationBySession.get(item.id)?.winner === "user").length;
  const casesById = new Map(((cases || []) as CaseRow[]).map((item) => [item.id, item]));
  const caseCounts = new Map<string, { name: string; count: number }>();
  for (const session of sessionRows) {
    const key = session.case_id || session.case_code;
    const current = caseCounts.get(key);
    caseCounts.set(key, { name: caseName(session, casesById), count: (current?.count || 0) + 1 });
  }
  const history: DuelHistoryItem[] = sessionRows.map((item) => {
    const evaluation = evaluationBySession.get(item.id);
    return { id: item.id, endedAt: item.ended_at, caseName: caseName(item, casesById), participantRole: participantRole(item, casesById), result: resultLabel(evaluation?.winner || ""), score: evaluation?.score ?? null };
  });
  return {
    profile,
    played: sessionRows.length,
    wins,
    winRate: sessionRows.length ? Math.round((wins / sessionRows.length) * 100) : 0,
    lastDuel: sessionRows[0]?.ended_at || null,
    topCases: [...caseCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, 3),
    history,
  };
}

export async function getRating(): Promise<UserStanding[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: profiles, error: profilesError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("user_profiles").select("id, first_name, last_name, email, created_at").eq("role", "user"),
    supabase.from("training_sessions").select("id, user_id, case_id, case_code, participant_role_name, opponent_name, ended_at").not("user_id", "is", null),
  ]);
  if (profilesError || sessionsError) throw new Error("Не удалось сформировать рейтинг пользователей.");
  const sessionRows = (sessions || []) as SessionRow[];
  const ids = sessionRows.map((item) => item.id);
  const { data: evaluations } = ids.length
    ? await supabase.from("evaluations").select("session_id, overall_score, result").in("session_id", ids)
    : { data: [] };
  const evaluationBySession = evaluationMap((evaluations || []) as EvaluationRow[]);
  return ((profiles || []) as ProfileRow[]).map((profile) => {
    const userSessions = sessionRows.filter((item) => item.user_id === profile.id).sort((a, b) => b.ended_at.localeCompare(a.ended_at));
    const wins = userSessions.filter((item) => evaluationBySession.get(item.id)?.winner === "user").length;
    const averageScore = averageLatestScores(userSessions.map((item) => evaluationBySession.get(item.id)?.score ?? null));
    return { id: profile.id, name: `${profile.first_name} ${profile.last_name}`, played: userSessions.length, wins, winRate: userSessions.length ? Math.round((wins / userSessions.length) * 100) : 0, averageScore, lastDuel: userSessions[0]?.ended_at || null };
  });
}
