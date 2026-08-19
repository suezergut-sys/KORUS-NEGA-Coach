import { buildRealtimeInstructions } from "@/lib/prompt";
import { resolvePublishedCase, resolvePublishedCaseForAdmin, selectCaseRoles } from "@/lib/case-resolver";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

function readParam(url: URL, key: string, fallback: string) {
  return (url.searchParams.get(key) || fallback).slice(0, 1200);
}

export async function GET() {
  return Response.json(
    { configured: Boolean(process.env.OPENAI_API_KEY) },
    { status: process.env.OPENAI_API_KEY ? 200 : 503 },
  );
}

export async function createRealtimeSession(request: Request, options: { adminCaseAccess?: boolean; skipTrainingSessionClaim?: boolean } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "На сервере не настроен OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const sdp = (await request.text()).slice(0, 100_000);
  const requestedVoice = readParam(url, "voice", "marin");
  const voice = requestedVoice === "cedar" ? "cedar" : "marin";
  const negotiationStyle = readParam(url, "negotiationStyle", "collaborative") === "hard" ? "hard" : "collaborative";
  const caseId = readParam(url, "caseId", "");
  const negotiationCase = options.adminCaseAccess
    ? await resolvePublishedCaseForAdmin(caseId)
    : await resolvePublishedCase(caseId, readParam(url, "caseCode", ""));
  if (!negotiationCase) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });
  const selected = selectCaseRoles(
    negotiationCase,
    Number(readParam(url, "participantRoleIndex", "0")),
    Number(readParam(url, "opponentRoleIndex", "1")),
  );
  const userRole = selected.participantRole;
  const opponentRole = selected.opponentRole;
  const instructions = buildRealtimeInstructions({
    role: `${opponentRole.name}, ${opponentRole.position}`,
    negotiationStyle,
    addressForm: negotiationCase.addressForm,
    context: negotiationCase.situation,
    conflict: `${negotiationCase.conflict}\n\nПредмет переговоров выбранной пары: ${selected.negotiationReason}`,
    startSituation: negotiationCase.startSituation,
    stakes: negotiationCase.stakes,
    userRole,
    opponentRole,
  });

  if (!sdp.startsWith("v=0")) {
    return Response.json({ error: "Некорректное SDP-предложение." }, { status: 400 });
  }

  if (!options.skipTrainingSessionClaim) {
    const user = await getCurrentUserSession();
    if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
    const trainingSessionId = readParam(url, "sessionId", "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trainingSessionId)) {
      return Response.json({ error: "Некорректная тренировочная сессия." }, { status: 400 });
    }
    const { data: claimed, error: claimError } = await getSupabaseAdmin().rpc("claim_training_realtime", {
      p_session_id: trainingSessionId,
      p_user_id: user.userId,
    });
    if (claimError) {
      return Response.json({ error: "Не удалось проверить дневной лимит тренировок." }, { status: 500 });
    }
    if (!claimed) {
      return Response.json({ error: "Тренировочная сессия уже использована или недоступна." }, { status: 409 });
    }
  }

  const sessionConfig = buildRealtimeSessionConfig({
    instructions,
    negotiationStyle,
    voice,
  });

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(sessionConfig));

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const responseBody = await openaiResponse.text();

    if (!openaiResponse.ok) {
      let message = "OpenAI не открыл Realtime-сессию.";
      try {
        const parsed = JSON.parse(responseBody) as { error?: { message?: string } };
        message = parsed.error?.message || message;
      } catch {
        // OpenAI can return a plain-text error; do not expose the whole response.
      }
      return Response.json({ error: message }, { status: openaiResponse.status });
    }

    return new Response(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch {
    return Response.json(
      { error: "Не удалось связаться с OpenAI Realtime API." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  return createRealtimeSession(request);
}
