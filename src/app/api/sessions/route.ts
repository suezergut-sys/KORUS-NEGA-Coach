import { resolvePublishedCase, selectCaseRoles } from "@/lib/case-resolver";
import { getMethodology } from "@/lib/methodologies";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

type CreateSessionRequest = {
  caseId?: unknown;
  caseCode?: unknown;
  participantRoleIndex?: unknown;
  opponentRoleIndex?: unknown;
  opponentVoice?: unknown;
  methodologyId?: unknown;
};

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const body = (await request.json()) as CreateSessionRequest;
    const negotiationCase = await resolvePublishedCase(clean(body.caseId, 80), clean(body.caseCode));
    if (!negotiationCase) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });
    const selected = selectCaseRoles(
      negotiationCase,
      Number(body.participantRoleIndex),
      Number(body.opponentRoleIndex),
    );
    const methodology = getMethodology(body.methodologyId);
    const db = getSupabaseAdmin();
    const [{ data: goal }, { data: privacy, error: privacyError }] = await Promise.all([
      db.from("user_learning_goals").select("goal_text,next_session_target").eq("user_id", user.userId).maybeSingle(),
      db.from("user_profiles").select("transcript_consent_at,transcript_retention_days").eq("id", user.userId).single(),
    ]);
    if (privacyError) throw new Error(privacyError.message);
    if (!privacy?.transcript_consent_at) {
      return Response.json(
        { error: "Для запуска тренировки подтвердите согласие на сохранение стенограммы в личном кабинете." },
        { status: 412 },
      );
    }
    const now = new Date().toISOString();
    const retentionExpiresAt = new Date(Date.now() + Number(privacy.transcript_retention_days || 365) * 86_400_000).toISOString();
    const { data, error } = await db
      .from("training_sessions")
      .insert({
        user_id: user.userId,
        case_id: negotiationCase.id.startsWith("default-") ? null : negotiationCase.id,
        case_code: negotiationCase.slug,
        case_context: `${negotiationCase.situation}\n\nЦентральный конфликт: ${negotiationCase.conflict}\n\nПредмет переговоров выбранной пары: ${selected.negotiationReason}\n\nФорма обращения: ${negotiationCase.addressForm === "informal" ? "на «ты»" : "на «вы»"}`,
        participant_role_name: selected.participantRole.name,
        opponent_name: selected.opponentRole.name,
        opponent_voice: clean(body.opponentVoice, 80) || (selected.opponentRole.voiceGender === "male" ? "cedar" : "marin"),
        started_at: now,
        ended_at: now,
        duration_seconds: 0,
        methodology_id: methodology.id,
        methodology_version: methodology.candidateVersion,
        goal_snapshot: [goal?.goal_text, goal?.next_session_target].filter(Boolean).join("\n").slice(0, 1000) || null,
        is_ranked: true,
        status: "live",
        retention_expires_at: retentionExpiresAt,
      })
      .select("id,started_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ sessionId: data.id, startedAt: data.started_at }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось создать тренировочную сессию." },
      { status: 500 },
    );
  }
}
