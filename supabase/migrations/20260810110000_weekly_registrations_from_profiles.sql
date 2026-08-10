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
  with activity as (
    select
      count(distinct user_id) filter (where event_type <> 'user_registered') as active_users,
      count(*) filter (where event_type = 'case_played') as played_cases,
      count(*) filter (where event_type in ('case_created', 'case_uploaded')) as created_cases,
      count(*) filter (where event_type = 'case_uploaded') as uploaded_cases
    from public.user_activity_events
    where occurred_at >= p_period_start
      and occurred_at < p_period_end
  ), registrations as (
    select count(*) as new_users
    from public.user_profiles
    where created_at >= p_period_start
      and created_at < p_period_end
  )
  select jsonb_build_object(
    'active_users', activity.active_users,
    'new_users', registrations.new_users,
    'played_cases', activity.played_cases,
    'created_cases', activity.created_cases,
    'uploaded_cases', activity.uploaded_cases
  )
  from activity cross join registrations;
$$;

revoke all on function public.user_activity_weekly_summary(timestamptz, timestamptz) from public;
grant execute on function public.user_activity_weekly_summary(timestamptz, timestamptz) to service_role;
