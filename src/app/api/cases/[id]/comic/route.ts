import { getSupabaseAdmin } from "@/lib/supabase-server";
import { generateCaseMedia } from "@/lib/case-media";
import { after } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();
  const { data: negotiationCase, error: caseError } = await db.from("negotiation_cases").select("id").eq("id", id).eq("status", "published").maybeSingle();
  if (caseError) return Response.json({ status: "failed", error: caseError.message }, { status: 500 });
  if (!negotiationCase) return Response.json({ status: "failed", error: "Опубликованный кейс не найден." }, { status: 404 });
  const { data: job, error: jobError } = await db.from("case_media_jobs").select("status,error,started_at,published_generation_id").eq("case_id", id).maybeSingle();
  if (jobError) return Response.json({ status: "failed", error: jobError.message }, { status: 500 });
  const stale = job?.status === "processing" && job.started_at && Date.parse(job.started_at) < Date.now() - 10 * 60 * 1000;
  if (!job || job.status === "pending" || stale) {
    after(async () => { try { await generateCaseMedia(id); } catch { /* job stores the error */ } });
  }
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
