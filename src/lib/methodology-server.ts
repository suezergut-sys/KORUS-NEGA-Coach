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

  if (!error && data?.length) return data as RetrievedMethodChunk[];

  // Совместимость на время между публикацией приложения и применением миграции RPC.
  const fallback = await supabase.rpc("match_method_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 20,
  });
  if (!fallback.error) {
    const matches = ((fallback.data || []) as RetrievedMethodChunk[])
    .filter((chunk) => chunk.source_id === sourceId)
    .slice(0, matchCount);
    if (matches.length) return matches;
  }

  const staticChunks = await supabase
    .from("document_chunks")
    .select("id,source_id,section_path,content")
    .eq("source_id", sourceId)
    .order("chunk_index")
    .limit(matchCount);
  if (staticChunks.error) throw new Error(`RAG: ${staticChunks.error.message}`);
  return (staticChunks.data || []).map((chunk) => ({ ...chunk, similarity: 0 }));
}

export function fuseMethodologyChunkResults(resultSets: RetrievedMethodChunk[][], matchCount: number) {
  const ranked = new Map<number, { chunk: RetrievedMethodChunk; score: number }>();
  for (const results of resultSets) {
    results.forEach((chunk, index) => {
      const current = ranked.get(chunk.id);
      const score = (current?.score || 0) + 1 / (60 + index + 1);
      ranked.set(chunk.id, {
        chunk: current && current.chunk.similarity >= chunk.similarity ? current.chunk : chunk,
        score,
      });
    });
  }

  const ordered = [...ranked.values()].sort((left, right) =>
    right.score - left.score || right.chunk.similarity - left.chunk.similarity || left.chunk.id - right.chunk.id);
  const finalCount = Math.min(20, Math.max(matchCount, Math.min(resultSets.length, 20)));
  const selectedIds = new Set<number>();
  const selected: RetrievedMethodChunk[] = [];
  const representativeSets = resultSets.length <= finalCount
    ? resultSets
    : Array.from({ length: finalCount }, (_, index) =>
      resultSets[Math.round(index * (resultSets.length - 1) / (finalCount - 1))]);

  // Keep the strongest match for each part of the conversation before filling
  // the remaining places by reciprocal-rank fusion. For exceptionally long
  // transcripts, sample these representatives evenly from beginning to end.
  for (const results of representativeSets) {
    const top = results[0];
    if (top && !selectedIds.has(top.id) && selected.length < finalCount) {
      selectedIds.add(top.id);
      selected.push(ranked.get(top.id)?.chunk || top);
    }
  }
  for (const item of ordered) {
    if (selected.length >= finalCount) break;
    if (selectedIds.has(item.chunk.id)) continue;
    selectedIds.add(item.chunk.id);
    selected.push(item.chunk);
  }
  return selected;
}

export async function retrieveMethodologyChunksForQueries(
  supabase: SupabaseClient,
  sourceId: string,
  queryEmbeddings: number[][],
  matchCount: number,
) {
  const resultSets: RetrievedMethodChunk[][] = [];
  const concurrency = 6;
  for (let index = 0; index < queryEmbeddings.length; index += concurrency) {
    resultSets.push(...await Promise.all(queryEmbeddings.slice(index, index + concurrency).map((embedding) =>
      retrieveMethodologyChunks(supabase, sourceId, embedding, matchCount))));
  }
  return fuseMethodologyChunkResults(resultSets, matchCount);
}
