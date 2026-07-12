import { mapCaseRow } from "@/lib/case-types";
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
        const item = mapCaseRow(row);
        return {
          ...item,
          userRole: { ...item.userRole, hiddenMotives: [] },
          opponentRole: { ...item.opponentRole, hiddenMotives: [] },
        };
      }),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить кейсы." }, { status: 500 });
  }
}
