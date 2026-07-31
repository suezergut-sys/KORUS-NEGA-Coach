import { validateFeedbackAudio } from "@/lib/feedback";
import { getOpenAI } from "@/lib/openai-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const form = await request.formData();
    const audio = validateFeedbackAudio(form.get("audio"));
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      language: "ru",
      prompt: "Описание управленческого переговорного кейса: участники, роли, история отношений, ограничения, спорные вопросы, риски и желаемые результаты.",
    });
    const text = transcription.text.trim();
    if (!text) throw new Error("Не удалось распознать речь. Попробуйте записать описание ещё раз.");
    return Response.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось расшифровать запись.";
    const status = message.includes("Запишите") || message.includes("пустой") || message.includes("слишком большая") || message.includes("формат") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
