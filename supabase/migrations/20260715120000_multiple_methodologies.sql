create or replace function public.match_method_chunks_by_source(
  query_embedding extensions.vector(1536),
  selected_source_id uuid,
  match_threshold float default 0.35,
  match_count integer default 8
)
returns table (
  id bigint,
  source_id uuid,
  chunk_index integer,
  section_path text,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chunks.id,
    chunks.source_id,
    chunks.chunk_index,
    chunks.section_path,
    chunks.content,
    1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.document_chunks as chunks
  where chunks.source_id = selected_source_id
    and chunks.embedding is not null
    and 1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by chunks.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(match_count, 20);
$$;

grant execute on function public.match_method_chunks_by_source(extensions.vector, uuid, float, integer)
  to service_role;
