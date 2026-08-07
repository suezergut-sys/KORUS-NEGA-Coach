import type { TranscriptionDiarized } from "openai/resources/audio/transcriptions";
import { DuelAudioValidationError, validateDuelAudioMetadata, type DuelAudioSegment } from "@/lib/duel-audio";
import { getOpenAI } from "@/lib/openai-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";
import {
  DUEL_TRANSCRIPTION_ATTEMPT_TIMEOUT_MS,
  duelTranscriptionErrorDetails,
  runDuelTranscriptionWithRetry,
} from "@/lib/duel-transcription-retry";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  const diagnosticId = crypto.randomUUID();
  const transcriptionStartedAt = Date.now();
  const db = getSupabaseAdmin();
  let storagePath = "";
  try {
    const body = await request.json() as Record<string, unknown>;
    const metadata = validateDuelAudioMetadata({
      fileName: body.fileName,
      sizeBytes: body.sizeBytes,
      mimeType: body.mimeType,
    });
    storagePath = String(body.path || "");
    if (!storagePath.startsWith(`${session.userId}/`) || storagePath.includes("..") || !storagePath.endsWith(`.${metadata.extension}`)) {
      throw new DuelAudioValidationError("Некорректный путь аудиофайла.");
    }

    const { data: audioBlob, error: downloadError } = await db.storage.from("duel-recordings").download(storagePath);
    if (downloadError || !audioBlob) throw new DuelAudioValidationError("Аудиофайл не найден. Загрузите его повторно.");
    validateDuelAudioMetadata({ fileName: metadata.fileName, sizeBytes: audioBlob.size, mimeType: metadata.mimeType });

    const audioFile = new File([await audioBlob.arrayBuffer()], metadata.fileName, { type: metadata.mimeType });
    const openai = getOpenAI();
    const transcription = await runDuelTranscriptionWithRetry(
      () => openai.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-transcribe-diarize",
        language: "ru",
        response_format: "diarized_json",
        chunking_strategy: "auto",
      }, { signal: AbortSignal.timeout(DUEL_TRANSCRIPTION_ATTEMPT_TIMEOUT_MS), maxRetries: 0 }) as unknown as Promise<TranscriptionDiarized>,
      (failure) => console.warn(JSON.stringify({
        event: "duel_audio_transcription_attempt_failed",
        diagnosticId,
        userId: session.userId,
        ...failure,
      })),
    );

    const segments: DuelAudioSegment[] = transcription.segments
      .map((segment) => ({
        speaker: String(segment.speaker || "").trim(),
        start: Number(segment.start || 0),
        end: Number(segment.end || 0),
        text: String(segment.text || "").trim(),
      }))
      .filter((segment) => segment.speaker && segment.text);
    const speakers = [...new Set(segments.map((segment) => segment.speaker))];
    if (!segments.length) throw new DuelAudioValidationError("Не удалось распознать речь в аудиозаписи.");

    console.info(JSON.stringify({
      event: "duel_audio_transcription_completed",
      diagnosticId,
      userId: session.userId,
      durationMs: Date.now() - transcriptionStartedAt,
    }));
    return Response.json({ duration: Number(transcription.duration || 0), speakers, segments, diagnosticId });
  } catch (error) {
    console.error(JSON.stringify({
      event: "duel_audio_transcription_failed",
      diagnosticId,
      userId: session.userId,
      durationMs: Date.now() - transcriptionStartedAt,
      error: duelTranscriptionErrorDetails(error),
    }));
    const status = error instanceof DuelAudioValidationError ? 400 : 500;
    return Response.json({
      error: status === 400 && error instanceof Error
        ? error.message
        : `Не удалось расшифровать аудиозапись. Попробуйте ещё раз. Код диагностики: ${diagnosticId}.`,
      diagnosticId,
    }, { status });
  } finally {
    if (storagePath.startsWith(`${session.userId}/`)) {
      const { error } = await db.storage.from("duel-recordings").remove([storagePath]);
      if (error) console.error(JSON.stringify({ event: "duel_audio_cleanup_failed", userId: session.userId, storagePath, error: error.message }));
    }
  }
}
