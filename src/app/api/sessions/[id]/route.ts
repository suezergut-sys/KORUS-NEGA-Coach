import { summarizeRealtimeMetrics } from "@/lib/realtime-metrics";
import { createSpeechTimingAudit, summarizeSpeechAnalytics } from "@/lib/speech-analytics";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normalizeAnalysisTurns } from "@/lib/transcript";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FinalizeRequest = {
  durationSeconds?: unknown;
  turns?: unknown;
  metrics?: unknown;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Некорректная сессия." }, { status: 400 });

  try {
    const body = (await request.json()) as FinalizeRequest;
    const turns = normalizeAnalysisTurns(body.turns);
    const metricsInput = body.metrics && typeof body.metrics === "object"
      ? body.metrics as Record<string, unknown>
      : {};
    const metrics = summarizeRealtimeMetrics(metricsInput);
    const speechAnalytics = summarizeSpeechAnalytics({
      inputMode: metricsInput.inputMode,
      turns,
      userSpeakingDurationsMs: metricsInput.userSpeakingDurationsMs,
      opponentSpeakingDurationsMs: metricsInput.opponentSpeakingDurationsMs,
      userResponseTimesMs: metricsInput.userResponseTimesMs,
      opponentTimingSource: metricsInput.opponentTimingSource,
      interruptionCount: metrics.interruptionCount,
    });
    const speechTiming = createSpeechTimingAudit(metricsInput);
    const durationValue = Number(body.durationSeconds);
    const durationSeconds = Number.isFinite(durationValue)
      ? Math.min(21_600, Math.max(0, Math.round(durationValue)))
      : 0;
    const db = getSupabaseAdmin();
    const { data: session, error: lookupError } = await db
      .from("training_sessions")
      .select("id,is_ranked,status")
      .eq("id", id)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!session) return Response.json({ error: "Сессия не найдена." }, { status: 404 });
    if (session.status === "analyzed") return Response.json({ sessionId: id, status: "analyzed" });

    const { data, error } = await db.rpc("finalize_training_session", {
      p_session_id: id,
      p_user_id: user.userId,
      p_duration_seconds: durationSeconds,
      p_used_hint: session.is_ranked === false,
      p_turns: turns,
      p_setup_latency_ms: metrics.setupLatencyMs,
      p_reply_latency_p50_ms: metrics.replyLatencyP50Ms,
      p_reply_latency_p95_ms: metrics.replyLatencyP95Ms,
      p_reply_latency_samples: metrics.replyLatencySamples,
      p_recovery_count: metrics.recoveryCount,
      p_interruption_count: metrics.interruptionCount,
      p_connection_error_count: metrics.connectionErrorCount,
      p_metric_details: {
        replyLatenciesMs: metrics.replyLatenciesMs,
        inputMode: metricsInput.inputMode === "duplex" ? "duplex" : "push_to_talk",
        speechAnalytics,
        speechTiming,
      },
    });
    if (error || !data) throw new Error(error?.message || "Сессию не удалось завершить.");
    return Response.json({
      sessionId: id,
      status: "analysis_pending",
      metrics: { ...metrics, speechAnalytics },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить стенограмму." },
      { status: 500 },
    );
  }
}
