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
    'active_users', count(distinct user_id) filter (where event_type <> 'user_registered'),
    'new_users', count(*) filter (where event_type = 'user_registered'),
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
