import { getOpenAI } from "@/lib/openai-server";
import { mapCaseRow, type CaseRole } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RoleSide = "user" | "opponent";
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
    const body = (await request.json()) as { caseId?: unknown; participantRoleSide?: unknown; voice?: unknown };
    const caseId = typeof body.caseId === "string" ? body.caseId : "";
    const participantRoleSide: RoleSide = body.participantRoleSide === "opponent" ? "opponent" : "user";
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
    const participantRole = participantRoleSide === "user" ? negotiationCase.userRole : negotiationCase.opponentRole;
    const opponentRole = participantRoleSide === "user" ? negotiationCase.opponentRole : negotiationCase.userRole;
    const narration = [
      `Тренировочный кейс «${negotiationCase.title}».`,
      negotiationCase.summary,
      `Ситуация. ${negotiationCase.situation}`,
      `Центральный конфликт. ${negotiationCase.conflict}`,
      describeRole(negotiationCase.userRole, 1),
      describeRole(negotiationCase.opponentRole, 2),
      `Ставки: ${list(negotiationCase.stakes)}.`,
      `Начальная ситуация. ${negotiationCase.startSituation}`,
      `Ваша выбранная роль: ${participantRole.name}. Искусственный интеллект играет роль: ${opponentRole.name}.`,
    ].join("\n\n").slice(0, 9000);

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
