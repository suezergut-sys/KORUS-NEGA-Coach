import { randomUUID } from "node:crypto";
import { validateDuelAudioMetadata, DuelAudioValidationError } from "@/lib/duel-audio";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });

  try {
    const metadata = validateDuelAudioMetadata(await request.json());
    const path = `${session.userId}/${randomUUID()}.${metadata.extension}`;
    const { data, error } = await getSupabaseAdmin()
      .storage
      .from("duel-recordings")
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.signedUrl) throw new Error(error?.message || "Не удалось подготовить загрузку аудио.");
    return Response.json({ path, signedUrl: data.signedUrl });
  } catch (error) {
    const status = error instanceof DuelAudioValidationError ? 400 : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось подготовить загрузку аудио." }, { status });
  }
}
