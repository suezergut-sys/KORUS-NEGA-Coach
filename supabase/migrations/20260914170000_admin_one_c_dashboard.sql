create or replace function public.admin_one_c_dashboard()
returns table (
  id uuid,
  first_name text,
  last_name text,
  registered_at timestamptz,
  last_login_at timestamptz,
  last_case_played_at timestamptz,
  played_cases bigint,
  average_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with one_c_users as (
    select
      profiles.id,
      profiles.first_name,
      profiles.last_name,
      profiles.created_at as registered_at
    from public.user_profiles profiles
    join public.departments departments on departments.id = profiles.department_id
    where departments.code = '1c'
  ),
  login_activity as (
    select events.user_id, max(events.occurred_at) as last_login_at
    from public.user_activity_events events
    where events.event_type = 'user_logged_in'
    group by events.user_id
  ),
  completed_sessions as (
    select
      sessions.id,
      sessions.user_id,
      sessions.ended_at,
      coalesce(evaluations.initial_overall_score, evaluations.overall_score) as score
    from public.training_sessions sessions
    left join public.evaluations evaluations on evaluations.session_id = sessions.id
    where sessions.status in ('completed', 'analysis_pending', 'analysis_processing', 'analyzed', 'analysis_failed')
  )
  select
    users.id,
    users.first_name,
    users.last_name,
    users.registered_at,
    logins.last_login_at,
    max(sessions.ended_at) as last_case_played_at,
    count(sessions.id) as played_cases,
    round(avg(sessions.score), 1) as average_score
  from one_c_users users
  left join login_activity logins on logins.user_id = users.id
  left join completed_sessions sessions
    on sessions.user_id = users.id
    and sessions.ended_at >= users.registered_at
  group by users.id, users.first_name, users.last_name, users.registered_at, logins.last_login_at
  order by lower(users.last_name), lower(users.first_name), users.id;
$$;

revoke all on function public.admin_one_c_dashboard() from public, anon, authenticated;
grant execute on function public.admin_one_c_dashboard() to service_role;

comment on function public.admin_one_c_dashboard() is
  'Закрытый дашборд активности и средних первичных оценок сотрудников департамента 1С.';
