alter table public.negotiation_cases add column if not exists additional_roles jsonb not null default '[]'::jsonb;
alter table public.case_variants add column if not exists additional_roles jsonb not null default '[]'::jsonb;
create table if not exists public.case_media_jobs (case_id uuid primary key references public.negotiation_cases(id) on delete cascade,status text not null default 'pending' check (status in ('pending','processing','ready','failed')),error text,started_at timestamptz,completed_at timestamptz,updated_at timestamptz not null default now());
create table if not exists public.case_comic_panels (id uuid primary key default gen_random_uuid(),case_id uuid not null references public.negotiation_cases(id) on delete cascade,role_index integer not null check(role_index>=0),panel_index integer not null check(panel_index>=0),eyebrow text not null,title text not null,narration text not null,image_path text not null,audio_path text not null,created_at timestamptz not null default now(),unique(case_id,role_index,panel_index));
alter table public.case_media_jobs enable row level security;
alter table public.case_comic_panels enable row level security;
grant all on public.case_media_jobs to service_role;
grant all on public.case_comic_panels to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('case-comics','case-comics',false,12582912,array['image/webp','audio/mpeg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
