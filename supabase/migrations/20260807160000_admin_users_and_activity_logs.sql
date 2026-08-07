alter table public.user_activity_events
  drop constraint if exists user_activity_events_event_type_check;

alter table public.user_activity_events
  add constraint user_activity_events_event_type_check
  check (event_type in (
    'case_played',
    'case_uploaded',
    'case_created',
    'user_registered',
    'feedback_submitted',
    'duel_analyzed'
  ));

create or replace function public.admin_user_overview()
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.first_name,
    profiles.last_name,
    profiles.email,
    profiles.created_at,
    max(events.occurred_at) as last_activity_at
  from public.user_profiles profiles
  left join public.user_activity_events events on events.user_id = profiles.id
  group by profiles.id, profiles.first_name, profiles.last_name, profiles.email, profiles.created_at
  order by profiles.created_at desc;
$$;

revoke all on function public.admin_user_overview() from public, anon, authenticated;
grant execute on function public.admin_user_overview() to service_role;

comment on function public.admin_user_overview() is
  'Закрытый административный список пользователей с датой последнего зафиксированного действия.';
