import { getOpenAI } from "@/lib/openai-server";
import { mapCaseRow, type CaseRole } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCaseComic } from "@/lib/case-comic";

export const runtime = "nodejs";
export const maxDuration = 60;

type NarrationVoice = "marin" | "cedar";

function list(items: string[]) {
  return items.length ? items.join("; ") : "не указаны";
}

function describeRole(role: CaseRole, number: number) {
  return [
    `Роль ${number}: ${role.name}. Должность или позиция: ${role.position}.`,
    `Открытая цель: ${role.publicGoal}.`,
    `Интересы: ${list(role.interests)}.`,
    `Ограничения: ${list(role.constraints)}.`,
  ].join(" ");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { caseId?: unknown; participantRoleIndex?: unknown; opponentRoleIndex?: unknown; voice?: unknown; panelIndex?: unknown };
    const caseId = typeof body.caseId === "string" ? body.caseId : "";
    const voice: NarrationVoice = body.voice === "cedar" ? "cedar" : "marin";
    if (!caseId) return Response.json({ error: "Не выбран кейс." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("negotiation_cases")
      .select("*")
      .eq("id", caseId)
      .eq("status", "published")
      .single();
    if (error || !data) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });

    const negotiationCase = mapCaseRow(data);
    const roles = [negotiationCase.userRole, negotiationCase.opponentRole, ...negotiationCase.additionalRoles];
    const requestedParticipant = Number(body.participantRoleIndex);
    const participantRoleIndex = Number.isInteger(requestedParticipant) && roles[requestedParticipant] ? requestedParticipant : 0;
    const requestedOpponent = Number(body.opponentRoleIndex);
    const opponentRoleIndex = Number.isInteger(requestedOpponent) && requestedOpponent !== participantRoleIndex && roles[requestedOpponent]
      ? requestedOpponent
      : roles.findIndex((_, index) => index !== participantRoleIndex);
    const participantRole = roles[participantRoleIndex];
    const opponentRole = roles[opponentRoleIndex];
    const fullNarration = [
      `Тренировочный кейс «${negotiationCase.title}».`,
      negotiationCase.summary,
      `Ситуация. ${negotiationCase.situation}`,
      `Центральный конфликт. ${negotiationCase.conflict}`,
      ...roles.map((role, index) => describeRole(role, index + 1)),
      `Ставки: ${list(negotiationCase.stakes)}.`,
      `Начальная ситуация. ${negotiationCase.startSituation}`,
      `Ваша выбранная роль: ${participantRole.name}. Искусственный интеллект играет роль: ${opponentRole.name}.`,
    ].join("\n\n").slice(0, 9000);
    const panelIndex = typeof body.panelIndex === "number" ? body.panelIndex : -1;
    const comicPanel = getCaseComic(negotiationCase)[panelIndex];
    const narration = comicPanel?.narration || fullNarration;

    const speech = await getOpenAI().audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice,
      input: narration,
      instructions: "Говори на естественном русском языке, ясно и увлекательно. Это вводный рассказ к управленческому поединку. Делай короткие паузы между разделами, не добавляй фактов от себя.",
      response_format: "mp3",
    });

    return new Response(await speech.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline; filename=case-narration.mp3",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось озвучить кейс." }, { status: 500 });
  }
}
