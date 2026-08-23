import Link from "next/link";
import CaseLibrary from "@/components/CaseLibrary";
import { publicCaseAuthor, sortCaseLibrary, type CaseLibraryItem } from "@/lib/case-library";
import { mapCaseRow, toPublicCase } from "@/lib/case-types";
import { canAccessCase } from "@/lib/case-visibility";
import { getCaseAccessContext } from "@/lib/case-access-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function CaseLibraryPage() {
  const session = await getCurrentUserSession();
  if (!session) return null;
  const db = getSupabaseAdmin();
  const access = await getCaseAccessContext(session);
  const [{ data: caseRows, error }, { data: sessions }, { data: jobs }] = await Promise.all([
    db.from("negotiation_cases").select("*").eq("status", "published").limit(500),
    db.from("training_sessions").select("case_id").not("case_id", "is", null).limit(10000),
    db.from("case_media_jobs").select("case_id,published_generation_id").not("published_generation_id", "is", null),
  ]);
  if (error) throw new Error(error.message);

  const accessibleRows = (caseRows || []).filter((row) => canAccessCase(row, access));
  const ownerIds = [...new Set(accessibleRows.map((row) => row.owner_user_id).filter(Boolean))] as string[];
  const { data: profiles } = ownerIds.length
    ? await db.from("user_profiles").select("id,first_name,last_name").in("id", ownerIds)
    : { data: [] };
  const ownerNames = new Map((profiles || []).map((profile) => [profile.id, `${profile.first_name || ""} ${profile.last_name || ""}`.replace(/\s+/g, " ").trim()]));
  const playCounts = new Map<string, number>();
  for (const training of sessions || []) playCounts.set(training.case_id, (playCounts.get(training.case_id) || 0) + 1);

  const generationIds = (jobs || []).map((job) => job.published_generation_id).filter(Boolean) as string[];
  const { data: panels } = generationIds.length
    ? await db.from("case_comic_panels").select("case_id,generation_id,image_path,role_index,panel_index").in("generation_id", generationIds).eq("role_index", 0).eq("panel_index", 0)
    : { data: [] };
  const panelByCase = new Map((panels || []).map((panel) => [panel.case_id, panel.image_path]));
  const imagePaths = [...new Set(panelByCase.values())];
  const { data: signed } = imagePaths.length ? await db.storage.from("case-comics").createSignedUrls(imagePaths, 3600) : { data: [] };
  const signedImages = new Map((signed || []).map((item, index) => [imagePaths[index], item.signedUrl || null]));

  const items = sortCaseLibrary(accessibleRows.map((row): CaseLibraryItem => {
    const item = toPublicCase(mapCaseRow(row));
    const mediaPath = panelByCase.get(item.id);
    return {
      ...item,
      createdAt: String(row.created_at),
      createdBy: ownerNames.get(String(row.owner_user_id || "")) || publicCaseAuthor(row.created_by, item.origin),
      plays: playCounts.get(item.id) || 0,
      comicImage: mediaPath ? signedImages.get(mediaPath) || null : (item.slug === "missed-project-deadline" ? "/case-comics/missed-project-deadline/01-crisis.png" : null),
    };
  }));

  return (
    <>
      <header className="admin-page-header case-library-header">
        <div><span className="admin-eyebrow">БИБЛИОТЕКА ТРЕНАЖЁРА</span><h1>База кейсов</h1><p>Выберите управленческую ситуацию, изучите роли и начните тренировку.</p></div>
        <div className="case-library-top-actions"><Link href="/?quickUpload=1">↑ Загрузить кейс</Link><Link href="/cases">＋ Создать кейс</Link></div>
      </header>
      <div className="case-library-count"><strong>{items.length}</strong><span>кейсов · сначала самые популярные</span></div>
      <CaseLibrary cases={items} />
    </>
  );
}
