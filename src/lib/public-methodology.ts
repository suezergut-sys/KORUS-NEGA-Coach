import "server-only";
import { getMethodology, type MethodologyId } from "@/lib/methodologies";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function getPublicMethodology(methodologyId: MethodologyId) {
  const methodology = getMethodology(methodologyId);
  const db = getSupabaseAdmin();
  const { data: source, error: sourceError } = await db
    .from("method_sources")
    .select("id,title,author,verification_status,methodology_version")
    .eq("code", methodology.sourceCode)
    .single();
  if (sourceError) throw new Error(sourceError.message);
  const { data: atoms, error: atomsError } = await db
    .from("method_atoms")
    .select("id,kind,title,statement,signals,counterexamples,source_quote,verification_status,methodology_version")
    .eq("source_id", source.id)
    .neq("verification_status", "rejected")
    .order("kind")
    .order("title");
  if (atomsError) throw new Error(atomsError.message);
  return { methodology, source, atoms: atoms || [] };
}
