create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  email text not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lower(split_part(email, '@', 2)) in ('korusconsulting.ru', 'mons.ru'))
);

alter table public.training_sessions
  add column if not exists user_id uuid references public.user_profiles(id) on delete set null;

create index if not exists training_sessions_user_ended_idx
  on public.training_sessions (user_id, ended_at desc);

alter table public.user_profiles enable row level security;
grant all on public.user_profiles to service_role;
grant all on public.training_sessions to service_role;

comment on table public.user_profiles is 'Профили участников тренажёра и их роли.';
comment on column public.training_sessions.user_id is 'Участник, сыгравший поединок; null для исторических данных до персональной авторизации.';
