create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  author_name text not null check (char_length(trim(author_name)) between 1 and 170),
  author_email text not null check (char_length(trim(author_email)) between 3 and 320),
  section_code text not null check (section_code in (
    'negotiations',
    'account',
    'rating',
    'case_upload',
    'case_builder',
    'case_analysis',
    'onboarding',
    'other'
  )),
  section_label text not null check (char_length(trim(section_label)) between 1 and 120),
  custom_section text check (custom_section is null or char_length(trim(custom_section)) between 1 and 120),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_feedback_created_idx
  on public.user_feedback (created_at desc);

create index if not exists user_feedback_processed_created_idx
  on public.user_feedback (processed, created_at desc);

alter table public.user_feedback enable row level security;
grant all on public.user_feedback to service_role;

comment on table public.user_feedback is 'Текстовая обратная связь участников; исходные голосовые записи не сохраняются.';
comment on column public.user_feedback.processed is 'Ручная отметка администратора о том, что обращение отработано.';
