import { resolvePublishedCase, selectCaseRoles } from "@/lib/case-resolver";
import { formatCaseGuidance } from "@/lib/case-guidance";
import { getMethodology, getRegisteredMethodology } from "@/lib/methodologies";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { mapDailyTrainingQuota } from "@/lib/training-quota";

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
    const methodology = negotiationCase.requiredMethodologyId
      ? getRegisteredMethodology(negotiationCase.requiredMethodologyId)
      : getMethodology(body.methodologyId);
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
    const retentionExpiresAt = new Date(Date.now() + Number(privacy.transcript_retention_days || 365) * 86_400_000).toISOString();
    const { data, error } = await db.rpc("create_training_session_with_daily_quota", {
      p_user_id: user.userId,
      p_case_id: negotiationCase.id.startsWith("default-") ? null : negotiationCase.id,
      p_case_code: negotiationCase.slug,
      p_case_context: `${negotiationCase.situation}\n\nЦентральный конфликт: ${negotiationCase.conflict}\n\nПредмет переговоров выбранной пары: ${selected.negotiationReason}\n\nФорма обращения: ${negotiationCase.addressForm === "informal" ? "на «ты»" : "на «вы»"}\n\n${formatCaseGuidance(negotiationCase, selected.participantRole, selected.opponentRole)}`,
      p_participant_role_name: selected.participantRole.name,
      p_opponent_name: selected.opponentRole.name,
      p_opponent_voice: clean(body.opponentVoice, 80) || (selected.opponentRole.voiceGender === "male" ? "cedar" : "marin"),
      p_methodology_id: methodology.id,
      p_methodology_version: methodology.candidateVersion,
      p_goal_snapshot: [goal?.goal_text, goal?.next_session_target].filter(Boolean).join("\n").slice(0, 1000) || null,
      p_retention_expires_at: retentionExpiresAt,
    });
    if (error) {
      console.error("Training session creation failed", { code: error.code || "unknown" });
      throw new Error("Не удалось создать тренировочную сессию.");
    }
    const row = (Array.isArray(data) ? data[0] : data) as {
      session_id?: string | null;
      started_at?: string;
      daily_limit?: number | null;
      used_today?: number;
      remaining_today?: number | null;
    } | null;
    const quota = mapDailyTrainingQuota(row);
    if (!row?.session_id) {
      return Response.json({ error: "Количество ежедневных тренировок исчерпано.", quota }, { status: 429 });
    }
    return Response.json({ sessionId: row.session_id, startedAt: row.started_at, quota }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось создать тренировочную сессию." },
      { status: 500 },
    );
  }
}
