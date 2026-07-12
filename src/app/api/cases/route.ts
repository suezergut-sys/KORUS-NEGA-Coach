import { mapCaseRow, toPublicCase } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("negotiation_cases")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return Response.json({
      cases: (data || []).map((row) => {
        return toPublicCase(mapCaseRow(row));
      }),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить кейсы." }, { status: 500 });
  }
}
