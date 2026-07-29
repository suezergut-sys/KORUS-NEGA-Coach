alter table public.user_profiles
  add column if not exists transcript_consent_at timestamptz,
  add column if not exists transcript_retention_days integer not null default 365
    check (transcript_retention_days in (30, 90, 180, 365, 730)),
  add column if not exists data_policy_version text not null default '2026-07-30';

alter table public.training_sessions
  add column if not exists retention_expires_at timestamptz;

update public.training_sessions sessions
set retention_expires_at = coalesce(sessions.ended_at, sessions.created_at) + (
  coalesce(profiles.transcript_retention_days, 365) || ' days'
)::interval
from public.user_profiles profiles
where sessions.user_id = profiles.id
  and sessions.retention_expires_at is null;

create index if not exists training_sessions_retention_idx
  on public.training_sessions (retention_expires_at)
  where retention_expires_at is not null;

comment on column public.user_profiles.transcript_consent_at is
  'Момент явного согласия пользователя на сохранение стенограмм тренировок.';
comment on column public.user_profiles.transcript_retention_days is
  'Срок хранения стенограмм и связанных учебных данных: 30, 90, 180, 365 или 730 дней.';
comment on column public.training_sessions.retention_expires_at is
  'После этой даты сессия и каскадно связанные стенограмма, оценка и метрики удаляются.';

create or replace function public.purge_expired_training_data()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare deleted_count integer;
begin
  delete from public.training_sessions
  where retention_expires_at is not null
    and retention_expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.purge_expired_training_data() to service_role;

create or replace function public.get_rating_page(
  p_requesting_user_id uuid,
  p_limit integer default 25,
  p_offset integer default 0,
  p_sort text default 'played',
  p_descending boolean default true
)
returns table (
  id uuid,
  name text,
  played bigint,
  wins bigint,
  win_rate integer,
  average_score integer,
  last_duel timestamptz,
  cases jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with profile_stats as (
    select
      profiles.id,
      trim(profiles.first_name || ' ' || profiles.last_name) as name,
      count(sessions.id)::bigint as played,
      count(sessions.id) filter (
        where evaluations.result->'outcome'->>'winner' = 'user'
      )::bigint as wins,
      case
        when count(sessions.id) = 0 then 0
        else round(
          100.0 * count(sessions.id) filter (
            where evaluations.result->'outcome'->>'winner' = 'user'
          ) / count(sessions.id)
        )::integer
      end as win_rate,
      scores.average_score,
      max(sessions.ended_at) as last_duel
    from public.user_profiles profiles
    left join public.training_sessions sessions
      on sessions.user_id = profiles.id
      and sessions.is_ranked = true
      and sessions.status = 'analyzed'
    left join public.evaluations evaluations on evaluations.session_id = sessions.id
    left join lateral (
      select round(avg(latest.overall_score))::integer as average_score
      from (
        select recent_evaluations.overall_score
        from public.training_sessions recent_sessions
        join public.evaluations recent_evaluations
          on recent_evaluations.session_id = recent_sessions.id
        where recent_sessions.user_id = profiles.id
          and recent_sessions.is_ranked = true
          and recent_sessions.status = 'analyzed'
          and recent_evaluations.overall_score is not null
        order by recent_sessions.ended_at desc
        limit 10
      ) latest
    ) scores on true
    where profiles.role = 'user'
    group by profiles.id, profiles.first_name, profiles.last_name, scores.average_score
  ),
  paged as (
    select profile_stats.*
    from profile_stats
    order by
      case when p_sort = 'wins' and p_descending then wins end desc nulls last,
      case when p_sort = 'wins' and not p_descending then wins end asc nulls last,
      case when p_sort = 'winRate' and p_descending then win_rate end desc nulls last,
      case when p_sort = 'winRate' and not p_descending then win_rate end asc nulls last,
      case when p_sort = 'averageScore' and p_descending then average_score end desc nulls last,
      case when p_sort = 'averageScore' and not p_descending then average_score end asc nulls last,
      case when (p_sort = 'played' or p_sort not in ('wins', 'winRate', 'averageScore')) and p_descending then played end desc nulls last,
      case when (p_sort = 'played' or p_sort not in ('wins', 'winRate', 'averageScore')) and not p_descending then played end asc nulls last,
      name asc,
      id asc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select
    paged.id,
    paged.name,
    paged.played,
    paged.wins,
    paged.win_rate,
    paged.average_score,
    paged.last_duel,
    coalesce(case_list.items, '[]'::jsonb) as cases,
    (select count(*) from profile_stats)::bigint as total_count
  from paged
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id',
          case
            when recent.visibility = 'private'
              and recent.owner_user_id is distinct from p_requesting_user_id then null
            else recent.case_id
          end,
        'name',
          case
            when recent.visibility = 'private'
              and recent.owner_user_id is distinct from p_requesting_user_id
              then 'Приватный кейс пользователя'
            else recent.case_name
          end,
        'playable',
          recent.is_default
          or recent.visibility = 'public'
          or recent.owner_user_id = p_requesting_user_id,
        'private', recent.visibility = 'private'
      )
      order by recent.ended_at desc
    ) as items
    from (
      select distinct_recent.*
      from (
        select distinct on (coalesce(sessions.case_id::text, sessions.case_code))
          sessions.case_id,
          sessions.case_code,
          sessions.ended_at,
          cases.owner_user_id,
          coalesce(cases.visibility, 'public') as visibility,
          sessions.case_id is null and sessions.case_code = 'missed-project-deadline' as is_default,
          coalesce(
            cases.title,
            case when sessions.case_code = 'missed-project-deadline'
              then 'Сорванный срок проекта'
              else sessions.case_code
            end
          ) as case_name
        from public.training_sessions sessions
        left join public.negotiation_cases cases on cases.id = sessions.case_id
        where sessions.user_id = paged.id
          and sessions.is_ranked = true
          and sessions.status = 'analyzed'
        order by coalesce(sessions.case_id::text, sessions.case_code), sessions.ended_at desc
      ) distinct_recent
      order by distinct_recent.ended_at desc
      limit 5
    ) recent
  ) case_list on true;
$$;

grant execute on function public.get_rating_page(uuid, integer, integer, text, boolean)
  to service_role;
