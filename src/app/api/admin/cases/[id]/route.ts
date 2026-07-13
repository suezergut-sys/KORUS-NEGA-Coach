import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { parseAdminCaseInput } from "@/lib/admin-case-input";
import { deleteNegotiationCase } from "@/lib/case-deletion";
import { generateCaseMedia } from "@/lib/case-media";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 300;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Требуется вход." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  try {
    const { id } = await params;
    const item = parseAdminCaseInput(await request.json());
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("negotiation_cases").update({
      title: item.title,
      summary: item.summary,
      situation: item.situation,
      conflict: item.conflict,
      user_role: item.userRole,
      opponent_role: item.opponentRole,
      additional_roles: item.additionalRoles,
      stakes: item.stakes,
      start_situation: item.startSituation,
      difficulty_reason: item.difficultyReason,
      evaluation_focus: item.evaluationFocus,
      methodology_basis: item.methodologyBasis,
      status: item.status,
      origin: item.origin,
      created_by: item.createdBy,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("id").single();
    if (error) throw new Error(error.message);
    await db.from("case_media_jobs").upsert({ case_id: id, status: "pending", error: null, updated_at: new Date().toISOString() }, { onConflict: "case_id" });
    if (item.status === "published") after(async () => { try { await generateCaseMedia(id); } catch { /* job stores error */ } });
    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${id}`);
    revalidatePath("/");
    return Response.json({ case: data, mediaStatus: item.status === "published" ? "pending" : "paused" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить кейс." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Требуется вход." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  const { id } = await params;
  try {
    const result = await deleteNegotiationCase(id);
    if (!result.found) return Response.json({ error: "Кейс не найден." }, { status: 404 });
    revalidatePath("/admin/cases");
    revalidatePath("/");
    return Response.json({ deleted: true, deletedFiles: result.deletedFiles });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось удалить кейс." }, { status: 500 });
  }
}
