alter table public.training_sessions
  add column if not exists methodology_id text not null default 'tarasov'
    check (methodology_id in ('tarasov', 'harvard')),
  add column if not exists analysis_attempts integer not null default 0
    check (analysis_attempts >= 0),
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_error text,
  add column if not exists goal_snapshot text;

alter table public.training_sessions
  drop constraint if exists training_sessions_status_check;

alter table public.training_sessions
  add constraint training_sessions_status_check
  check (status in (
    'live',
    'completed',
    'analysis_pending',
    'analysis_processing',
    'analyzed',
    'analysis_failed'
  ));

create table if not exists public.session_metrics (
  session_id uuid primary key references public.training_sessions(id) on delete cascade,
  setup_latency_ms integer check (setup_latency_ms between 0 and 120000),
  reply_latency_p50_ms integer check (reply_latency_p50_ms between 0 and 120000),
  reply_latency_p95_ms integer check (reply_latency_p95_ms between 0 and 120000),
  reply_latency_samples integer not null default 0 check (reply_latency_samples between 0 and 10000),
  recovery_count integer not null default 0 check (recovery_count between 0 and 10000),
  interruption_count integer not null default 0 check (interruption_count between 0 and 10000),
  connection_error_count integer not null default 0 check (connection_error_count between 0 and 10000),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_learning_goals (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  focus_skill text not null default '' check (char_length(focus_skill) <= 160),
  goal_text text not null default '' check (char_length(goal_text) <= 1000),
  next_session_target text not null default '' check (char_length(next_session_target) <= 1000),
  updated_at timestamptz not null default now()
);

create table if not exists public.practice_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  source_session_id uuid not null references public.training_sessions(id) on delete cascade,
  skill text not null check (char_length(trim(skill)) between 1 and 240),
  why text not null check (char_length(trim(why)) between 1 and 2000),
  practice text not null check (char_length(trim(practice)) between 1 and 3000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_session_id, skill, practice)
);

create index if not exists practice_tasks_user_status_idx
  on public.practice_tasks (user_id, status, created_at desc);

alter table public.session_metrics enable row level security;
alter table public.user_learning_goals enable row level security;
alter table public.practice_tasks enable row level security;

grant all on public.session_metrics to service_role;
grant all on public.user_learning_goals to service_role;
grant all on public.practice_tasks to service_role;

create or replace function public.finalize_training_session(
  p_session_id uuid,
  p_user_id uuid,
  p_duration_seconds integer,
  p_used_hint boolean,
  p_turns jsonb,
  p_setup_latency_ms integer,
  p_reply_latency_p50_ms integer,
  p_reply_latency_p95_ms integer,
  p_reply_latency_samples integer,
  p_recovery_count integer,
  p_interruption_count integer,
  p_connection_error_count integer,
  p_metric_details jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_turns) <> 'array' then
    raise exception 'Turns must be a JSON array';
  end if;

  perform 1
  from public.training_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Training session not found';
  end if;

  delete from public.turns where session_id = p_session_id;
  insert into public.turns (session_id, sequence, speaker, text, client_event_id, spoken_at)
  select
    p_session_id,
    (turn_item.ordinality - 1)::integer,
    case turn_item.item->>'author' when 'Вы' then 'user' else 'opponent' end,
    left(trim(turn_item.item->>'text'), 2000),
    left(coalesce(turn_item.item->>'id', ''), 120),
    left(coalesce(turn_item.item->>'time', ''), 20)
  from jsonb_array_elements(p_turns) with ordinality as turn_item(item, ordinality)
  where turn_item.item->>'author' in ('Вы', 'Оппонент')
    and char_length(trim(coalesce(turn_item.item->>'text', ''))) > 0;

  insert into public.session_metrics (
    session_id,
    setup_latency_ms,
    reply_latency_p50_ms,
    reply_latency_p95_ms,
    reply_latency_samples,
    recovery_count,
    interruption_count,
    connection_error_count,
    details,
    updated_at
  ) values (
    p_session_id,
    greatest(0, least(120000, p_setup_latency_ms)),
    greatest(0, least(120000, p_reply_latency_p50_ms)),
    greatest(0, least(120000, p_reply_latency_p95_ms)),
    greatest(0, least(10000, p_reply_latency_samples)),
    greatest(0, least(10000, p_recovery_count)),
    greatest(0, least(10000, p_interruption_count)),
    greatest(0, least(10000, p_connection_error_count)),
    coalesce(p_metric_details, '{}'::jsonb),
    now()
  )
  on conflict (session_id) do update set
    setup_latency_ms = excluded.setup_latency_ms,
    reply_latency_p50_ms = excluded.reply_latency_p50_ms,
    reply_latency_p95_ms = excluded.reply_latency_p95_ms,
    reply_latency_samples = excluded.reply_latency_samples,
    recovery_count = excluded.recovery_count,
    interruption_count = excluded.interruption_count,
    connection_error_count = excluded.connection_error_count,
    details = excluded.details,
    updated_at = now();

  update public.training_sessions
  set ended_at = now(),
      duration_seconds = greatest(0, least(21600, p_duration_seconds)),
      is_ranked = not p_used_hint,
      status = case when status = 'analyzed' then status else 'analysis_pending' end,
      analysis_error = null
  where id = p_session_id and user_id = p_user_id;

  return true;
end;
$$;

grant execute on function public.finalize_training_session(
  uuid, uuid, integer, boolean, jsonb, integer, integer, integer,
  integer, integer, integer, integer, jsonb
) to service_role;

create or replace function public.claim_training_analysis(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.training_sessions
  set status = 'analysis_processing',
      analysis_started_at = now(),
      analysis_attempts = analysis_attempts + 1,
      analysis_error = null
  where id = p_session_id
    and user_id = p_user_id
    and (
      status in ('analysis_pending', 'analysis_failed')
      or (
        status = 'analysis_processing'
        and analysis_started_at < now() - interval '5 minutes'
      )
    );
  return found;
end;
$$;

grant execute on function public.claim_training_analysis(uuid, uuid) to service_role;

alter table public.case_media_jobs
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists max_attempts integer not null default 4 check (max_attempts between 1 and 10),
  add column if not exists next_attempt_at timestamptz not null default now();

create index if not exists case_media_jobs_queue_idx
  on public.case_media_jobs (status, next_attempt_at, updated_at);

create or replace function public.enqueue_case_media_job(
  p_case_id uuid,
  p_force boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.case_media_jobs (
    case_id, status, error, attempt_count, next_attempt_at, updated_at
  )
  values (p_case_id, 'pending', null, 0, now(), now())
  on conflict (case_id) do update set
    status = case
      when p_force or public.case_media_jobs.status in ('failed', 'pending') then 'pending'
      else public.case_media_jobs.status
    end,
    error = case when p_force then null else public.case_media_jobs.error end,
    attempt_count = case when p_force then 0 else public.case_media_jobs.attempt_count end,
    next_attempt_at = case when p_force then now() else public.case_media_jobs.next_attempt_at end,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.claim_case_media_job(
  p_case_id uuid,
  p_force boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare claimed_generation uuid := gen_random_uuid();
begin
  perform public.enqueue_case_media_job(p_case_id, false);

  update public.case_media_jobs
  set status = 'processing',
      error = null,
      generation_id = claimed_generation,
      started_at = now(),
      completed_at = null,
      attempt_count = case when p_force then 1 else attempt_count + 1 end,
      next_attempt_at = now(),
      updated_at = now()
  where case_id = p_case_id
    and (
      p_force
      or (
        attempt_count < max_attempts
        and next_attempt_at <= now()
        and (
          status in ('pending', 'failed')
          or (status = 'processing' and started_at < now() - interval '10 minutes')
        )
      )
    );
  if not found then return null; end if;
  return claimed_generation;
end;
$$;

create or replace function public.schedule_case_media_retry(
  p_case_id uuid,
  p_generation_id uuid,
  p_error text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare next_status text;
begin
  update public.case_media_jobs
  set status = case when attempt_count >= max_attempts then 'failed' else 'pending' end,
      error = left(coalesce(p_error, 'Ошибка медиаконвейера'), 1000),
      next_attempt_at = case
        when attempt_count >= max_attempts then now()
        else now() + least(900, (power(2, attempt_count)::integer * 15)) * interval '1 second'
      end,
      updated_at = now()
  where case_id = p_case_id
    and generation_id = p_generation_id
  returning status into next_status;
  return next_status;
end;
$$;

grant execute on function public.enqueue_case_media_job(uuid, boolean) to service_role;
grant execute on function public.claim_case_media_job(uuid, boolean) to service_role;
grant execute on function public.schedule_case_media_retry(uuid, uuid, text) to service_role;
