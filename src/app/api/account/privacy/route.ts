import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

const RETENTION_OPTIONS = new Set([30, 90, 180, 365, 730]);

export async function GET() {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  const { data, error } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("transcript_consent_at,transcript_retention_days,data_policy_version")
    .eq("id", user.userId)
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    consent: Boolean(data.transcript_consent_at),
    consentAt: data.transcript_consent_at,
    retentionDays: data.transcript_retention_days,
    policyVersion: data.data_policy_version,
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const body = await request.json() as { consent?: unknown; retentionDays?: unknown };
    if (typeof body.consent !== "boolean") {
      return Response.json({ error: "Укажите решение о сохранении стенограмм." }, { status: 400 });
    }
    const retentionDays = Number(body.retentionDays);
    if (!RETENTION_OPTIONS.has(retentionDays)) {
      return Response.json({ error: "Недопустимый срок хранения." }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("user_profiles")
      .update({
        transcript_consent_at: body.consent ? new Date().toISOString() : null,
        transcript_retention_days: retentionDays,
        data_policy_version: "2026-07-30",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.userId)
      .select("transcript_consent_at,transcript_retention_days,data_policy_version")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({
      consent: Boolean(data.transcript_consent_at),
      consentAt: data.transcript_consent_at,
      retentionDays: data.transcript_retention_days,
      policyVersion: data.data_policy_version,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить настройки приватности." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  const db = getSupabaseAdmin();
  const { count, error } = await db
    .from("training_sessions")
    .delete({ count: "exact" })
    .eq("user_id", user.userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ deletedSessions: count || 0 });
}
