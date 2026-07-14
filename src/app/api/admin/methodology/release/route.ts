import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getMethodology } from "@/lib/methodologies";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Требуется вход." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json().catch(() => ({})) as { methodologyId?: string };
  const methodology = getMethodology(body.methodologyId);
  const { data: source, error: sourceLookupError } = await supabase
    .from("method_sources")
    .select("id")
    .eq("code", methodology.sourceCode)
    .single();
  if (sourceLookupError) return Response.json({ error: sourceLookupError.message }, { status: 500 });
  const { data: atoms, error } = await supabase
    .from("method_atoms")
    .select("id,verification_status")
    .eq("source_id", source.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const candidate = (atoms || []).filter((atom) => atom.verification_status === "candidate").length;
  const verified = (atoms || []).filter((atom) => atom.verification_status === "verified").length;
  if (candidate > 0) {
    return Response.json({ error: `Сначала примите решение по всем атомам. Осталось: ${candidate}.` }, { status: 400 });
  }
  if (verified < 10) {
    return Response.json({ error: "Для версии v1 требуется минимум 10 подтверждённых атомов." }, { status: 400 });
  }

  const releasedAt = new Date().toISOString();
  const { error: atomsError } = await supabase
    .from("method_atoms")
    .update({ methodology_version: methodology.releaseVersion })
    .eq("verification_status", "verified")
    .eq("source_id", source.id);
  if (atomsError) return Response.json({ error: atomsError.message }, { status: 500 });

  const { error: sourceError } = await supabase
    .from("method_sources")
    .update({ verification_status: "verified", methodology_version: methodology.releaseVersion, updated_at: releasedAt })
    .eq("code", methodology.sourceCode);
  if (sourceError) return Response.json({ error: sourceError.message }, { status: 500 });

  return Response.json({ methodologyVersion: methodology.releaseVersion, verifiedAtoms: verified, releasedAt });
}
