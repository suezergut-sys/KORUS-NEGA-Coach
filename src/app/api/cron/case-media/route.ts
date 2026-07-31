import { processCaseMediaQueue } from "@/lib/case-media";
import { cleanupStaleDuelAudio } from "@/lib/duel-audio-storage";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Недопустимый ключ фонового задания." }, { status: 401 });
  }

  try {
    const [result, retention, staleDuelAudioDeleted] = await Promise.all([
      processCaseMediaQueue(2),
      getSupabaseAdmin().rpc("purge_expired_training_data"),
      cleanupStaleDuelAudio(),
    ]);
    if (retention.error) throw new Error(retention.error.message);
    return Response.json({ ok: true, ...result, expiredSessionsDeleted: Number(retention.data || 0), staleDuelAudioDeleted });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось обработать очередь." },
      { status: 500 },
    );
  }
}
