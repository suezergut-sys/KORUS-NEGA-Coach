import "server-only";
import type { NegotiationAnalysis } from "@/lib/analysis-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { DEFAULT_CASE } from "@/lib/default-case";
import { averageLatestScores, calculateSkillProgress } from "@/lib/user-stats-core";
import { canAccessCase } from "@/lib/case-visibility";
import { getCurrentUserSession } from "@/lib/user-auth";
import type { MethodologyId } from "@/lib/methodologies";

type ProfileRow = { id: string; first_name: string; last_name: string; email: string; created_at: string };
type SessionRow = {
  id: string;
  user_id: string;
  case_id: string | null;
  case_code: string;
  participant_role_name: string | null;
  opponent_name: string;
  ended_at: string;
  is_ranked: boolean;
  status: string;
  methodology_id?: MethodologyId;
};
type EvaluationRow = { session_id: string; overall_score: number | null; result: NegotiationAnalysis | null };
type CaseRow = {
  id: string;
  title: string;
  user_role: { name?: string };
  opponent_role: { name?: string };
  additional_roles: Array<{ name?: string }> | null;
  visibility?: string;
  owner_user_id?: string | null;
};

export type DuelHistoryItem = {
  id: string;
  endedAt: string;
  caseName: string;
  participantRole: string;
  result: "Победа" | "Поражение" | "Ничья" | "Не определён";
  score: number | null;
  ranked: boolean;
  status: string;
};

export type SkillProgressItem = {
  id: string;
  label: string;
  average: number;
  latest: number;
  delta: number | null;
  attempts: number;
};

export type PracticeTask = {
  id: string;
  source_session_id: string;
  skill: string;
  why: string;
  practice: string;
  status: "pending" | "completed" | "skipped";
  completed_at: string | null;
  created_at: string;
};

export type LearningGoal = {
  focus_skill: string;
  goal_text: string;
  next_session_target: string;
  updated_at: string | null;
};

export type UserStanding = {
  id: string;
  name: string;
  played: number;
  wins: number;
  winRate: number;
  averageScore: number | null;
  lastDuel: string | null;
  cases: Array<{ id: string | null; name: string; playable: boolean; private: boolean }>;
};

function evaluationMap(rows: EvaluationRow[]) {
  return new Map(rows.map((row) => [row.session_id, { winner: row.result?.outcome?.winner || "", score: row.overall_score, result: row.result }]));
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

async function loadCases(caseIds: string[]) {
  if (!caseIds.length) return [] as CaseRow[];
  const { data } = await getSupabaseAdmin()
    .from("negotiation_cases")
    .select("id,title,user_role,opponent_role,additional_roles,visibility,owner_user_id")
    .in("id", caseIds);
  return (data || []) as CaseRow[];
}

export async function getUserDashboard(userId: string) {
  const supabase = getSupabaseAdmin();
  const [
    { data: profile, error: profileError },
    { data: sessions, error: sessionsError },
    { data: learningGoal },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("user_profiles").select("id, first_name, last_name, email, created_at").eq("id", userId).single<ProfileRow>(),
    supabase.from("training_sessions").select("id,user_id,case_id,case_code,participant_role_name,opponent_name,ended_at,is_ranked,status,methodology_id").eq("user_id", userId).in("status", ["analyzed", "analysis_failed", "analysis_pending"]).order("ended_at", { ascending: false }).limit(100),
    supabase.from("user_learning_goals").select("focus_skill,goal_text,next_session_target,updated_at").eq("user_id", userId).maybeSingle(),
    supabase.from("practice_tasks").select("id,source_session_id,skill,why,practice,status,completed_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (profileError || !profile) throw new Error("Профиль пользователя не найден.");
  if (sessionsError) throw new Error(`Не удалось загрузить статистику: ${sessionsError.message}`);
  const sessionRows = (sessions || []) as SessionRow[];
  const ids = sessionRows.map((item) => item.id);
  const caseIds = [...new Set(sessionRows.map((item) => item.case_id).filter(Boolean))] as string[];
  const [{ data: evaluations }, cases] = await Promise.all([
    ids.length ? supabase.from("evaluations").select("session_id,overall_score,result").in("session_id", ids) : Promise.resolve({ data: [] }),
    loadCases(caseIds),
  ]);
  const evaluationRows = (evaluations || []) as EvaluationRow[];
  const evaluationBySession = evaluationMap(evaluationRows);
  const orderedEvaluations = sessionRows.map((session) => evaluationRows.find((item) => item.session_id === session.id)).filter((item): item is EvaluationRow => Boolean(item));
  const rankedSessions = sessionRows.filter((item) => item.is_ranked && item.status === "analyzed");
  const wins = rankedSessions.filter((item) => evaluationBySession.get(item.id)?.winner === "user").length;
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const caseCounts = new Map<string, { name: string; count: number }>();
  for (const session of rankedSessions) {
    const key = session.case_id || session.case_code;
    const current = caseCounts.get(key);
    caseCounts.set(key, { name: caseName(session, casesById), count: (current?.count || 0) + 1 });
  }
  const history: DuelHistoryItem[] = sessionRows.map((item) => {
    const evaluation = evaluationBySession.get(item.id);
    return {
      id: item.id,
      endedAt: item.ended_at,
      caseName: caseName(item, casesById),
      participantRole: participantRole(item, casesById),
      result: resultLabel(evaluation?.winner || ""),
      score: evaluation?.score ?? null,
      ranked: item.is_ranked,
      status: item.status,
    };
  });
  return {
    profile,
    played: rankedSessions.length,
    wins,
    winRate: rankedSessions.length ? Math.round((wins / rankedSessions.length) * 100) : 0,
    averageScore: averageLatestScores(rankedSessions.map((item) => evaluationBySession.get(item.id)?.score ?? null)),
    lastDuel: sessionRows[0]?.ended_at || null,
    topCases: [...caseCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, 3),
    history,
    skillProgress: calculateSkillProgress(orderedEvaluations.map((item) => item.result)) as SkillProgressItem[],
    learningGoal: (learningGoal || { focus_skill: "", goal_text: "", next_session_target: "", updated_at: null }) as LearningGoal,
    tasks: (tasks || []) as PracticeTask[],
  };
}

export async function getUserSessionReport(userId: string, sessionId: string) {
  const db = getSupabaseAdmin();
  const { data: session, error: sessionError } = await db
    .from("training_sessions")
    .select("id,user_id,case_id,case_code,participant_role_name,opponent_name,ended_at,is_ranked,status,methodology_id,duration_seconds,goal_snapshot")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;
  const [{ data: evaluation }, { data: metrics }, cases] = await Promise.all([
    db.from("evaluations").select("overall_score,result,created_at").eq("session_id", sessionId).maybeSingle(),
    db.from("session_metrics").select("setup_latency_ms,reply_latency_p50_ms,reply_latency_p95_ms,reply_latency_samples,recovery_count,interruption_count,connection_error_count").eq("session_id", sessionId).maybeSingle(),
    loadCases(session.case_id ? [session.case_id] : []),
  ]);
  if (!evaluation?.result) return { session, analysis: null, metrics, caseName: caseName(session as SessionRow, new Map(cases.map((item) => [item.id, item]))), previous: null };

  const { data: previousSession } = await db
    .from("training_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("case_code", session.case_code)
    .eq("status", "analyzed")
    .lt("ended_at", session.ended_at)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: previousEvaluation } = previousSession
    ? await db.from("evaluations").select("overall_score,result").eq("session_id", previousSession.id).maybeSingle()
    : { data: null };
  return {
    session,
    analysis: evaluation.result as NegotiationAnalysis,
    metrics,
    caseName: caseName(session as SessionRow, new Map(cases.map((item) => [item.id, item]))),
    previous: previousEvaluation ? { sessionId: previousSession?.id, score: previousEvaluation.overall_score, analysis: previousEvaluation.result as NegotiationAnalysis } : null,
  };
}

export async function getRating(): Promise<UserStanding[]> {
  const supabase = getSupabaseAdmin();
  const currentSession = await getCurrentUserSession();
  const [{ data: profiles, error: profilesError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("user_profiles").select("id, first_name, last_name, email, created_at").eq("role", "user"),
    supabase.from("training_sessions").select("id,user_id,case_id,case_code,participant_role_name,opponent_name,ended_at,is_ranked,status").not("user_id", "is", null).eq("is_ranked", true).eq("status", "analyzed"),
  ]);
  if (profilesError || sessionsError) throw new Error("Не удалось сформировать рейтинг пользователей.");
  const sessionRows = (sessions || []) as SessionRow[];
  const ids = sessionRows.map((item) => item.id);
  const caseIds = [...new Set(sessionRows.map((item) => item.case_id).filter(Boolean))] as string[];
  const [{ data: evaluations }, cases] = await Promise.all([
    ids.length ? supabase.from("evaluations").select("session_id,overall_score,result").in("session_id", ids) : Promise.resolve({ data: [] }),
    loadCases(caseIds),
  ]);
  const evaluationBySession = evaluationMap((evaluations || []) as EvaluationRow[]);
  const casesById = new Map(cases.map((item) => [item.id, item]));
  return ((profiles || []) as ProfileRow[]).map((profile) => {
    const userSessions = sessionRows.filter((item) => item.user_id === profile.id).sort((a, b) => b.ended_at.localeCompare(a.ended_at));
    const wins = userSessions.filter((item) => evaluationBySession.get(item.id)?.winner === "user").length;
    const averageScore = averageLatestScores(userSessions.map((item) => evaluationBySession.get(item.id)?.score ?? null));
    const standingCases = new Map<string, UserStanding["cases"][number]>();
    for (const session of userSessions) {
      if (standingCases.size >= 5) break;
      const storedCase = session.case_id ? casesById.get(session.case_id) : null;
      const key = session.case_id || session.case_code;
      if (standingCases.has(key)) continue;
      const isDefault = !session.case_id && session.case_code === DEFAULT_CASE.slug;
      const isPrivate = storedCase?.visibility === "private";
      standingCases.set(key, {
        id: storedCase?.id || (isDefault ? DEFAULT_CASE.id : null),
        name: storedCase?.title || (isDefault ? DEFAULT_CASE.title : session.case_code),
        playable: isDefault || Boolean(storedCase && canAccessCase(storedCase, currentSession?.userId)),
        private: isPrivate,
      });
    }
    return {
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      played: userSessions.length,
      wins,
      winRate: userSessions.length ? Math.round((wins / userSessions.length) * 100) : 0,
      averageScore,
      lastDuel: userSessions[0]?.ended_at || null,
      cases: [...standingCases.values()],
    };
  });
}
