import "server-only";

import { uniqueCaseMediaPaths, type CaseMediaRow } from "@/lib/case-media-paths";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function deleteNegotiationCase(caseId: string) {
  const db = getSupabaseAdmin();
  const { data: negotiationCase, error: caseError } = await db.from("negotiation_cases").select("id").eq("id", caseId).maybeSingle();
  if (caseError) throw new Error(caseError.message);
  if (!negotiationCase) return { found: false, deletedFiles: 0 };

  const { data: panels, error: panelsError } = await db
    .from("case_comic_panels")
    .select("image_path,audio_path")
    .eq("case_id", caseId);
  if (panelsError) throw new Error(`Не удалось получить список файлов кейса: ${panelsError.message}`);

  const paths = uniqueCaseMediaPaths((panels || []) as CaseMediaRow[]);
  if (paths.length) {
    const { error: storageError } = await db.storage.from("case-comics").remove(paths);
    if (storageError) throw new Error(`Не удалось удалить файлы комикса: ${storageError.message}`);
  }

  const { error: deleteError } = await db.from("negotiation_cases").delete().eq("id", caseId);
  if (deleteError) throw new Error(deleteError.message);
  return { found: true, deletedFiles: paths.length };
}
