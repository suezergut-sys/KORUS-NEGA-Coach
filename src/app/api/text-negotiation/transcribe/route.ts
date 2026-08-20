import { readBoundedFormData } from "@/lib/bounded-form-data";
import { getOpenAI } from "@/lib/openai-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { TEXT_NEGOTIATION_MAX_AUDIO_BYTES, validateTextNegotiationAudio } from "@/lib/text-negotiation";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const form = await readBoundedFormData(request, TEXT_NEGOTIATION_MAX_AUDIO_BYTES + 100_000);
    const sessionId = String(form.get("sessionId") || "").trim();
    if (!UUID.test(sessionId)) return Response.json({ error: "Некорректная тренировочная сессия." }, { status: 400 });
    const { data: session, error: sessionError } = await getSupabaseAdmin()
      .from("training_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.userId)
      .eq("status", "live")
      .not("realtime_started_at", "is", null)
      .maybeSingle();
    if (sessionError) throw new Error("Не удалось проверить тренировочную сессию.");
    if (!session) return Response.json({ error: "Активная текстовая тренировка не найдена." }, { status: 409 });
    const audio = validateTextNegotiationAudio(form.get("audio"));
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      language: "ru",
      prompt: "Русскоязычная реплика участника управленческого поединка KORUS NEGA AI.",
    });
    const text = transcription.text.trim();
    if (!text) throw new Error("Не удалось распознать речь. Попробуйте записать реплику ещё раз.");
    return Response.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось расшифровать голосовую реплику.";
    const status = /Запишите|пуст|больш|формат|Размер|Ожидалась/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
