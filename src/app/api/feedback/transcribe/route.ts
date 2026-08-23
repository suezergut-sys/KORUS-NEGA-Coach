import { validateFeedbackAudio } from "@/lib/feedback";
import { getOpenAI } from "@/lib/openai-server";
import { buildVerbatimTranscriptionPrompt, finalTranscriptText } from "@/lib/transcription";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = validateFeedbackAudio(form.get("audio"));
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe",
      language: "ru",
      prompt: buildVerbatimTranscriptionPrompt("обратная связь пользователя о тренажёре управленческих переговоров"),
    });
    const text = finalTranscriptText(transcription.text);
    if (!text) throw new Error("Не удалось распознать речь. Попробуйте записать сообщение ещё раз.");
    return Response.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось расшифровать запись.";
    const status = message.includes("Запишите") || message.includes("пустой") || message.includes("слишком большая") || message.includes("формат") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
