import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const KINDS = new Set(["principle", "stratagem", "case_rule", "evaluation_criterion", "example"]);
const STATUSES = new Set(["candidate", "verified", "rejected"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 500)).filter(Boolean).slice(0, 20);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Требуется вход." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const kind = text(body.kind, 80);
  const status = text(body.verificationStatus, 40);
  if (!KINDS.has(kind) || !STATUSES.has(status)) {
    return Response.json({ error: "Некорректный тип или статус." }, { status: 400 });
  }

  const title = text(body.title, 240);
  const statement = text(body.statement, 4000);
  if (!title || !statement) return Response.json({ error: "Название и формулировка обязательны." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("method_atoms")
    .update({
      kind,
      title,
      statement,
      signals: stringArray(body.signals),
      counterexamples: stringArray(body.counterexamples),
      verification_status: status,
      reviewer_note: text(body.reviewerNote, 3000) || null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      methodology_version: "tarasov-v0-candidate",
    })
    .eq("id", id)
    .select("id,kind,title,statement,signals,counterexamples,verification_status,reviewer_note,verified_at,methodology_version")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await supabase
    .from("method_sources")
    .update({ verification_status: "candidate", methodology_version: "tarasov-v0-candidate", updated_at: new Date().toISOString() })
    .eq("code", "SRC-001");

  return Response.json({ atom: data });
}

