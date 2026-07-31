create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  user_name text not null check (char_length(trim(user_name)) between 1 and 170),
  event_type text not null check (event_type in ('case_played', 'case_uploaded', 'case_created')),
  entity_id uuid not null,
  subject_title text,
  occurred_at timestamptz not null default now(),
  telegram_sent_at timestamptz,
  unique (event_type, entity_id)
);

create index if not exists user_activity_events_period_idx
  on public.user_activity_events (occurred_at, event_type);

create index if not exists user_activity_events_user_period_idx
  on public.user_activity_events (user_id, occurred_at);

alter table public.user_activity_events enable row level security;
grant all on public.user_activity_events to service_role;

comment on table public.user_activity_events is
  'События активности участников для оперативных Telegram-уведомлений и недельной статистики.';
comment on column public.user_activity_events.telegram_sent_at is
  'Момент успешной отправки оперативного уведомления; null сохраняет информацию о сбое доставки.';

create table if not exists public.user_activity_weekly_reports (
  period_start date primary key,
  period_end date not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table public.user_activity_weekly_reports enable row level security;
grant all on public.user_activity_weekly_reports to service_role;

create or replace function public.user_activity_weekly_summary(
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_users', count(distinct user_id),
    'played_cases', count(*) filter (where event_type = 'case_played'),
    'created_cases', count(*) filter (where event_type in ('case_created', 'case_uploaded')),
    'uploaded_cases', count(*) filter (where event_type = 'case_uploaded')
  )
  from public.user_activity_events
  where occurred_at >= p_period_start
    and occurred_at < p_period_end;
$$;

revoke all on function public.user_activity_weekly_summary(timestamptz, timestamptz) from public;
grant execute on function public.user_activity_weekly_summary(timestamptz, timestamptz) to service_role;

