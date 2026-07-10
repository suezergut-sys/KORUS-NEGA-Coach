import { getSupabaseAdmin } from "@/lib/supabase-server";
import MethodologyReview from "@/components/MethodologyReview";

export default async function MethodologyReviewPage() {
  const supabase = getSupabaseAdmin();
  const [{ data: atoms, error }, { data: source }] = await Promise.all([
    supabase
      .from("method_atoms")
      .select("id,chunk_id,kind,title,statement,signals,counterexamples,source_quote,verification_status,reviewer_note,methodology_version")
      .order("created_at", { ascending: true }),
    supabase.from("method_sources").select("methodology_version,verification_status").eq("code", "SRC-001").single(),
  ]);
  if (error) throw new Error(error.message);

  const chunkIds = [...new Set((atoms || []).map((atom) => atom.chunk_id).filter(Boolean))];
  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id,section_path,content,chunk_index")
    .in("id", chunkIds);
  if (chunksError) throw new Error(chunksError.message);
  const chunkMap = new Map((chunks || []).map((chunk) => [chunk.id, chunk]));

  return (
    <MethodologyReview
      initialAtoms={(atoms || []).map((atom) => ({
        id: atom.id,
        kind: atom.kind,
        title: atom.title,
        statement: atom.statement,
        signals: Array.isArray(atom.signals) ? atom.signals : [],
        counterexamples: Array.isArray(atom.counterexamples) ? atom.counterexamples : [],
        sourceQuote: atom.source_quote,
        verificationStatus: atom.verification_status,
        reviewerNote: atom.reviewer_note || "",
        methodologyVersion: atom.methodology_version,
        sectionPath: chunkMap.get(atom.chunk_id)?.section_path || "Раздел не определён",
        sourceContext: chunkMap.get(atom.chunk_id)?.content || "Контекст недоступен",
        chunkIndex: chunkMap.get(atom.chunk_id)?.chunk_index || 0,
      }))}
      sourceStatus={source?.verification_status === "verified" ? "verified" : "candidate"}
      sourceVersion={source?.methodology_version || "tarasov-v0-candidate"}
    />
  );
}

