import { parseFeedbackInput } from "@/lib/feedback";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
    const feedback = parseFeedbackInput(await request.json());
    const db = getSupabaseAdmin();
    const { data: profile, error: profileError } = await db
      .from("user_profiles")
      .select("first_name,last_name,email")
      .eq("id", session.userId)
      .single();
    if (profileError || !profile) throw new Error("Не удалось определить автора обратной связи.");

    const authorName = `${profile.first_name || ""} ${profile.last_name || ""}`.replace(/\s+/g, " ").trim();
    const { data, error } = await db.from("user_feedback").insert({
      user_id: session.userId,
      author_name: authorName,
      author_email: profile.email || session.email,
      section_code: feedback.section,
      section_label: feedback.sectionLabel,
      custom_section: feedback.customSection,
      content: feedback.content,
    }).select("id,created_at").single();
    if (error) throw new Error(error.message);
    return Response.json({ feedback: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить обратную связь.";
    const status = message.startsWith("Выберите") || message.startsWith("Укажите") || message.startsWith("Напишите") || message.includes("5000") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
