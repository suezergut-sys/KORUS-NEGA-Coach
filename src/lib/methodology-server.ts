import type { SupabaseClient } from "@supabase/supabase-js";
import type { Methodology } from "@/lib/methodologies";

export type RetrievedMethodChunk = {
  id: number;
  source_id: string;
  section_path: string;
  content: string;
  similarity: number;
};

export async function getMethodologySource(supabase: SupabaseClient, methodology: Methodology) {
  const { data, error } = await supabase
    .from("method_sources")
    .select("id,code,title,author,verification_status,methodology_version")
    .eq("code", methodology.sourceCode)
    .single();
  if (error) throw new Error(`Источник методологии «${methodology.shortName}» не загружен: ${error.message}`);
  return data;
}

export async function retrieveMethodologyChunks(
  supabase: SupabaseClient,
  sourceId: string,
  queryEmbedding: number[],
  matchCount: number,
) {
  const { data, error } = await supabase.rpc("match_method_chunks_by_source", {
    query_embedding: queryEmbedding,
    selected_source_id: sourceId,
    match_threshold: 0.3,
    match_count: matchCount,
  });

  if (!error) return (data || []) as RetrievedMethodChunk[];

  // Совместимость на время между публикацией приложения и применением миграции RPC.
  const fallback = await supabase.rpc("match_method_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 20,
  });
  if (fallback.error) throw new Error(`RAG: ${fallback.error.message}`);
  return ((fallback.data || []) as RetrievedMethodChunk[])
    .filter((chunk) => chunk.source_id === sourceId)
    .slice(0, matchCount);
}
