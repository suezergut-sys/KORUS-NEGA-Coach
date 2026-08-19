alter table public.user_profiles
  add column if not exists training_tier text not null default 'standard';

alter table public.user_profiles
  drop constraint if exists user_profiles_training_tier_check;

alter table public.user_profiles
  add constraint user_profiles_training_tier_check
  check (training_tier in ('standard', 'premium'));

alter table public.training_sessions
  add column if not exists realtime_started_at timestamptz;

create index if not exists training_sessions_daily_quota_idx
  on public.training_sessions (user_id, started_at desc);

comment on column public.user_profiles.training_tier is
  'Управляемый администратором тариф дневных тренировок: standard — 3, premium — 20.';

comment on column public.training_sessions.realtime_started_at is
  'Время одноразового допуска записи тренировки к созданию платной OpenAI Realtime-сессии.';

create or replace function public.daily_training_quota(p_user_id uuid)
returns table (
  training_tier text,
  daily_limit integer,
  used_today integer,
  remaining_today integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_tier text;
  v_limit integer;
  v_used integer;
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
begin
  select profiles.role, profiles.training_tier
  into v_role, v_tier
  from public.user_profiles profiles
  where profiles.id = p_user_id;

  if not found then
    raise exception 'USER_PROFILE_NOT_FOUND';
  end if;

  v_limit := case
    when v_role = 'admin' then null
    when v_tier = 'premium' then 20
    else 3
  end;
  v_today_start := date_trunc('day', timezone('Europe/Moscow', now())) at time zone 'Europe/Moscow';
  v_tomorrow_start := (date_trunc('day', timezone('Europe/Moscow', now())) + interval '1 day') at time zone 'Europe/Moscow';

  select count(*)::integer
  into v_used
  from public.training_sessions sessions
  where sessions.user_id = p_user_id
    and sessions.started_at >= v_today_start
    and sessions.started_at < v_tomorrow_start;

  return query select
    v_tier,
    v_limit,
    v_used,
    case when v_limit is null then null else greatest(v_limit - v_used, 0) end;
end;
$$;

create or replace function public.create_training_session_with_daily_quota(
  p_user_id uuid,
  p_case_id uuid,
  p_case_code text,
  p_case_context text,
  p_participant_role_name text,
  p_opponent_name text,
  p_opponent_voice text,
  p_methodology_id text,
  p_methodology_version text,
  p_goal_snapshot text,
  p_retention_expires_at timestamptz
)
returns table (
  session_id uuid,
  started_at timestamptz,
  daily_limit integer,
  used_today integer,
  remaining_today integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_tier text;
  v_limit integer;
  v_used integer;
  v_now timestamptz := now();
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
  v_session_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select profiles.role, profiles.training_tier
  into v_role, v_tier
  from public.user_profiles profiles
  where profiles.id = p_user_id;

  if not found then
    raise exception 'USER_PROFILE_NOT_FOUND';
  end if;

  v_limit := case
    when v_role = 'admin' then null
    when v_tier = 'premium' then 20
    else 3
  end;
  v_today_start := date_trunc('day', timezone('Europe/Moscow', v_now)) at time zone 'Europe/Moscow';
  v_tomorrow_start := (date_trunc('day', timezone('Europe/Moscow', v_now)) + interval '1 day') at time zone 'Europe/Moscow';

  select count(*)::integer
  into v_used
  from public.training_sessions sessions
  where sessions.user_id = p_user_id
    and sessions.started_at >= v_today_start
    and sessions.started_at < v_tomorrow_start;

  if v_limit is not null and v_used >= v_limit then
    return query select null::uuid, v_now, v_limit, v_used, 0;
    return;
  end if;

  insert into public.training_sessions (
    user_id,
    case_id,
    case_code,
    case_context,
    participant_role_name,
    opponent_name,
    opponent_voice,
    started_at,
    ended_at,
    duration_seconds,
    methodology_id,
    methodology_version,
    goal_snapshot,
    is_ranked,
    status,
    retention_expires_at
  ) values (
    p_user_id,
    p_case_id,
    p_case_code,
    p_case_context,
    p_participant_role_name,
    p_opponent_name,
    p_opponent_voice,
    v_now,
    v_now,
    0,
    p_methodology_id,
    p_methodology_version,
    p_goal_snapshot,
    true,
    'live',
    p_retention_expires_at
  ) returning id into v_session_id;

  v_used := v_used + 1;
  return query select
    v_session_id,
    v_now,
    v_limit,
    v_used,
    case when v_limit is null then null else greatest(v_limit - v_used, 0) end;
end;
$$;

create or replace function public.claim_training_realtime(p_session_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed integer;
begin
  update public.training_sessions
  set realtime_started_at = now()
  where id = p_session_id
    and user_id = p_user_id
    and status = 'live'
    and realtime_started_at is null;

  get diagnostics v_claimed = row_count;
  return v_claimed = 1;
end;
$$;

drop function if exists public.admin_user_overview();

create function public.admin_user_overview()
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  role text,
  training_tier text,
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
    profiles.role,
    profiles.training_tier,
    profiles.created_at,
    max(events.occurred_at) as last_activity_at
  from public.user_profiles profiles
  left join public.user_activity_events events on events.user_id = profiles.id
  group by profiles.id, profiles.first_name, profiles.last_name, profiles.email, profiles.role, profiles.training_tier, profiles.created_at
  order by profiles.created_at desc;
$$;

revoke all on function public.daily_training_quota(uuid) from public, anon, authenticated;
revoke all on function public.create_training_session_with_daily_quota(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_training_realtime(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_user_overview() from public, anon, authenticated;

grant execute on function public.daily_training_quota(uuid) to service_role;
grant execute on function public.create_training_session_with_daily_quota(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.claim_training_realtime(uuid, uuid) to service_role;
grant execute on function public.admin_user_overview() to service_role;

comment on function public.daily_training_quota(uuid) is
  'Возвращает использованные и оставшиеся тренировки за текущий московский календарный день.';

comment on function public.create_training_session_with_daily_quota(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz) is
  'Атомарно проверяет дневной лимит и создаёт запись тренировки; конкурентные старты одного пользователя сериализуются.';

comment on function public.claim_training_realtime(uuid, uuid) is
  'Одноразово разрешает принадлежащей пользователю тренировке открыть платную OpenAI Realtime-сессию.';
