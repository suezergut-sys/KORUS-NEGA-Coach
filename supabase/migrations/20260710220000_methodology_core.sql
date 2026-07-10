create extension if not exists vector with schema extensions;

create table if not exists public.method_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  author text not null,
  title text not null,
  source_format text not null,
  sha256 text not null unique,
  storage_path text,
  methodology_version text not null default 'tarasov-v0-candidate',
  verification_status text not null default 'candidate'
    check (verification_status in ('candidate', 'verified', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null references public.method_sources(id) on delete cascade,
  chunk_index integer not null,
  section_path text not null,
  content text not null,
  char_start integer not null default 0,
  char_end integer not null default 0,
  embedding_model text not null default 'text-embedding-3-small',
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create index if not exists document_chunks_source_idx
  on public.document_chunks (source_id, chunk_index);
create index if not exists document_chunks_embedding_hnsw
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

create table if not exists public.method_atoms (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.method_sources(id) on delete cascade,
  chunk_id bigint references public.document_chunks(id) on delete set null,
  kind text not null check (kind in (
    'principle', 'stratagem', 'case_rule', 'evaluation_criterion', 'example'
  )),
  title text not null,
  statement text not null,
  signals jsonb not null default '[]'::jsonb,
  counterexamples jsonb not null default '[]'::jsonb,
  source_quote text not null,
  methodology_version text not null default 'tarasov-v0-candidate',
  verification_status text not null default 'candidate'
    check (verification_status in ('candidate', 'verified', 'rejected')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (source_id, kind, title, source_quote)
);

create index if not exists method_atoms_status_idx
  on public.method_atoms (verification_status, kind);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  case_code text not null,
  case_context text not null,
  opponent_name text not null,
  opponent_voice text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null default 0,
  realtime_model text not null default 'gpt-realtime-2',
  methodology_version text not null default 'tarasov-v0-candidate',
  status text not null default 'completed'
    check (status in ('completed', 'analysis_pending', 'analyzed', 'analysis_failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.turns (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  sequence integer not null,
  speaker text not null check (speaker in ('user', 'opponent', 'system')),
  text text not null,
  client_event_id text,
  spoken_at text,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.training_sessions(id) on delete cascade,
  analysis_model text not null,
  methodology_version text not null,
  methodology_status text not null check (methodology_status in ('candidate', 'verified')),
  overall_score integer check (overall_score between 0 and 100),
  summary text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_evidence (
  id bigint generated always as identity primary key,
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  turn_id bigint references public.turns(id) on delete set null,
  atom_id uuid references public.method_atoms(id) on delete set null,
  turn_quote text not null,
  source_quote text not null,
  section_path text not null,
  rationale text not null,
  confidence real not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

alter table public.method_sources enable row level security;
alter table public.document_chunks enable row level security;
alter table public.method_atoms enable row level security;
alter table public.training_sessions enable row level security;
alter table public.turns enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_evidence enable row level security;

grant usage on schema public to service_role;
grant all on public.method_sources to service_role;
grant all on public.document_chunks to service_role;
grant all on public.method_atoms to service_role;
grant all on public.training_sessions to service_role;
grant all on public.turns to service_role;
grant all on public.evaluations to service_role;
grant all on public.evaluation_evidence to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.match_method_chunks(
  query_embedding extensions.vector(1536),
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
  where chunks.embedding is not null
    and 1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by chunks.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(match_count, 20);
$$;

grant execute on function public.match_method_chunks(extensions.vector, float, integer)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'methodology-sources',
  'methodology-sources',
  false,
  10485760,
  array['application/xml', 'text/xml', 'application/octet-stream']
)
on conflict (id) do update set public = false;
