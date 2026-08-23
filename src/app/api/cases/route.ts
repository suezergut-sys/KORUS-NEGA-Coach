import { mapCaseRow, toPublicCase } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { canAccessCase } from "@/lib/case-visibility";
import { getCaseAccessContext } from "@/lib/case-access-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const access = await getCaseAccessContext(session);
    const { data, error } = await getSupabaseAdmin()
      .from("negotiation_cases")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return Response.json({
      cases: (data || []).filter((row) => canAccessCase(row, access)).map((row) => {
        return toPublicCase(mapCaseRow(row));
      }),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить кейсы." }, { status: 500 });
  }
}
