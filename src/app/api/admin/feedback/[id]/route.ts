import { parseFeedbackStatusInput } from "@/lib/feedback";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { processed } = parseFeedbackStatusInput(await request.json());
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("user_feedback")
      .update({
        processed,
        processed_at: processed ? now : null,
        updated_at: now,
      })
      .eq("id", id)
      .select("id,processed,processed_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ feedback: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить статус.";
    return Response.json({ error: message }, { status: message.startsWith("Некорректный") ? 400 : 500 });
  }
}
