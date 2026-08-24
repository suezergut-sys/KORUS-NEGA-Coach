import { buildRealtimeInstructions } from "@/lib/prompt";
import { resolvePublishedCase, selectCaseRoles } from "@/lib/case-resolver";
import { buildFirstOpponentTurnInstructions } from "@/lib/realtime-language";
import { firstSpeakerForCase, matchesTrainingSessionStart } from "@/lib/negotiation-start";
import { getOpenAI } from "@/lib/openai-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { TEXT_NEGOTIATION_MODEL, textNegotiationInput, textNegotiationModeInstructions } from "@/lib/text-negotiation";
import { normalizeAnalysisTurns } from "@/lib/transcript";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  return Response.json({ configured: Boolean(process.env.OPENAI_API_KEY), model: TEXT_NEGOTIATION_MODEL }, {
    status: process.env.OPENAI_API_KEY ? 200 : 503,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = clean(body.sessionId, 80);
    if (!UUID.test(sessionId)) return Response.json({ error: "Некорректная тренировочная сессия." }, { status: 400 });
    const action = body.action === "start" ? "start" : "turn";
    const negotiationStyle = body.negotiationStyle === "hard" ? "hard" : "collaborative";
    const negotiationCase = await resolvePublishedCase(clean(body.caseId, 80), clean(body.caseCode));
    if (!negotiationCase) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });
    const firstSpeaker = firstSpeakerForCase(negotiationCase, body.firstSpeaker);
    const selected = selectCaseRoles(negotiationCase, Number(body.participantRoleIndex), Number(body.opponentRoleIndex));
    const db = getSupabaseAdmin();
    const { data: trainingSession, error: sessionError } = await db
      .from("training_sessions")
      .select("case_id,case_code,participant_role_name,opponent_name,realtime_started_at,status")
      .eq("id", sessionId)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (sessionError) throw new Error("Не удалось проверить тренировочную сессию.");
    if (!trainingSession || trainingSession.status !== "live" || !matchesTrainingSessionStart({
      saved: trainingSession,
      expected: {
        caseId: negotiationCase.id.startsWith("default-") ? null : negotiationCase.id,
        caseCode: negotiationCase.slug,
        participantRoleName: selected.participantRole.name,
        opponentRoleName: selected.opponentRole.name,
      },
    })) {
      return Response.json({ error: "Настройки запуска не совпадают с активной тренировочной сессией." }, { status: 409 });
    }

    if (action === "start") {
      const { data: claimed, error: claimError } = await db.rpc("claim_training_realtime", {
        p_session_id: sessionId,
        p_user_id: user.userId,
      });
      if (claimError) throw new Error("Не удалось активировать тренировочную сессию.");
      if (!claimed) return Response.json({ error: "Тренировочная сессия уже использована или недоступна." }, { status: 409 });
      if (firstSpeaker === "participant") return Response.json({ ready: true });
    } else if (!trainingSession.realtime_started_at) {
      return Response.json({ error: "Сначала запустите текстовый поединок." }, { status: 409 });
    }

    const turns = normalizeAnalysisTurns(body.turns);
    if (action === "turn" && (turns.length === 0 || turns.at(-1)?.author !== "Вы")) {
      return Response.json({ error: "Введите реплику участника." }, { status: 400 });
    }

    const baseInstructions = buildRealtimeInstructions({
      title: negotiationCase.title,
      summary: negotiationCase.summary,
      negotiationStyle,
      firstSpeaker,
      addressForm: negotiationCase.addressForm,
      context: negotiationCase.situation,
      conflict: `${negotiationCase.conflict}\n\nПредмет переговоров выбранной пары: ${selected.negotiationReason}`,
      startSituation: negotiationCase.startSituation,
      stakes: negotiationCase.stakes,
      difficultyReason: negotiationCase.difficultyReason,
      evaluationFocus: negotiationCase.evaluationFocus,
      methodologyBasis: negotiationCase.methodologyBasis,
      scenarioConditions: negotiationCase.scenarioConditions,
      decisionTerms: negotiationCase.decisionTerms,
      authorityLimits: negotiationCase.authorityLimits,
      riskZones: negotiationCase.riskZones,
      successOutcome: negotiationCase.successOutcome,
      expectedNextSteps: negotiationCase.expectedNextSteps,
      methodologyNotes: negotiationCase.methodologyNotes,
      userRole: selected.participantRole,
      opponentRole: selected.opponentRole,
    });
    const firstTurnInstructions = action === "start"
      ? `\n\n${buildFirstOpponentTurnInstructions({ participantRole: selected.participantRole, opponentRole: selected.opponentRole })}`
      : "";
    const response = await getOpenAI().responses.create({
      model: TEXT_NEGOTIATION_MODEL,
      reasoning: { effort: "low" },
      instructions: `${baseInstructions}\n\n${textNegotiationModeInstructions(negotiationCase.slug)}${firstTurnInstructions}`,
      input: textNegotiationInput(turns, action === "start"),
      max_output_tokens: 500,
      store: false,
    });
    const reply = response.output_text.trim();
    if (!reply) throw new Error("Модель не вернула реплику оппонента.");
    return Response.json({ reply });
  } catch (error) {
    console.error("Text negotiation failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось получить ответ оппонента." }, { status: 500 });
  }
}
