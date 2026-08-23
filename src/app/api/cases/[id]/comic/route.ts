import { getSupabaseAdmin } from "@/lib/supabase-server";
import { enqueueCaseMedia } from "@/lib/case-media";
import { getCaseAccessContext } from "@/lib/case-access-server";
import { canAccessCase } from "@/lib/case-visibility";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ status: "failed", error: "Требуется авторизация." }, { status: 401 });
  const { id } = await context.params;
  const db = getSupabaseAdmin();
  const { data: negotiationCase, error: caseError } = await db.from("negotiation_cases").select("id,visibility,owner_user_id,department_id").eq("id", id).eq("status", "published").maybeSingle();
  if (caseError) return Response.json({ status: "failed", error: caseError.message }, { status: 500 });
  if (!negotiationCase || !canAccessCase(negotiationCase, await getCaseAccessContext(session))) return Response.json({ status: "failed", error: "Кейс не найден или недоступен." }, { status: 404 });
  const { data: job, error: jobError } = await db.from("case_media_jobs").select("status,error,started_at,published_generation_id").eq("case_id", id).maybeSingle();
  if (jobError) return Response.json({ status: "failed", error: jobError.message }, { status: 500 });
  if (!job) await enqueueCaseMedia(id);
  if (!job?.published_generation_id) return Response.json({ status: job?.status || "pending", error: job?.error || null, versions: {} });
  const { data: panels, error } = await db
    .from("case_comic_panels")
    .select("role_index,panel_index,eyebrow,title,narration,image_path,audio_path")
    .eq("case_id", id)
    .eq("generation_id", job.published_generation_id)
    .order("role_index")
    .order("panel_index");
  if (error) return Response.json({ status: "failed", error: error.message }, { status: 500 });
  if (!panels?.length) return Response.json({ status: job?.status || "pending", error: job?.error || null, versions: {} });
  const paths = [...new Set(panels.flatMap((p) => [p.image_path, p.audio_path]))];
  const signed = await db.storage.from("case-comics").createSignedUrls(paths, 3600);
  if (signed.error || !signed.data || signed.data.some((item) => item.error || !item.signedUrl)) {
    return Response.json({ status: "failed", error: signed.error?.message || "Не удалось создать ссылки на медиапакет." }, { status: 500 });
  }
  const urls = new Map((signed.data || []).map((item, index) => [paths[index], item.signedUrl]));
  const versions: Record<string, unknown[]> = {};
  for (const panel of panels) {
    const key = String(panel.role_index);
    (versions[key] ||= []).push({ image: urls.get(panel.image_path), audio: urls.get(panel.audio_path), eyebrow: panel.eyebrow, title: panel.title, narration: panel.narration });
  }
  return Response.json({ status: job.status, error: job.error || null, versions });
}
