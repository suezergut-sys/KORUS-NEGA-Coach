import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();
  const [{ data: job }, { data: panels, error }] = await Promise.all([
    db.from("case_media_jobs").select("status,error").eq("case_id", id).maybeSingle(),
    db.from("case_comic_panels").select("role_index,panel_index,eyebrow,title,narration,image_path,audio_path").eq("case_id", id).order("role_index").order("panel_index"),
  ]);
  if (error) return Response.json({ status: "failed", error: error.message }, { status: 500 });
  if (!panels?.length) return Response.json({ status: job?.status || "pending", error: job?.error || null, versions: {} });
  const paths = [...new Set(panels.flatMap((p) => [p.image_path, p.audio_path]))];
  const signed = await db.storage.from("case-comics").createSignedUrls(paths, 3600);
  const urls = new Map((signed.data || []).map((item, index) => [paths[index], item.signedUrl]));
  const versions: Record<string, unknown[]> = {};
  for (const panel of panels) {
    const key = String(panel.role_index);
    (versions[key] ||= []).push({ image: urls.get(panel.image_path), audio: urls.get(panel.audio_path), eyebrow: panel.eyebrow, title: panel.title, narration: panel.narration });
  }
  return Response.json({ status: "ready", versions });
}
