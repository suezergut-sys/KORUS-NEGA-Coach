create unique index if not exists negotiation_cases_source_variant_unique
  on public.negotiation_cases (source_variant_id)
  where source_variant_id is not null;

create or replace function public.approve_case_variant(p_variant_id uuid, p_origin text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  approved_id uuid;
  workspace_id_value uuid;
  approved_at_value timestamptz := now();
begin
  if p_origin not in ('quick_upload', 'builder') then
    raise exception 'Unsupported case origin';
  end if;

  select workspace_id into workspace_id_value
  from public.case_variants
  where id = p_variant_id;
  if workspace_id_value is null then raise exception 'Case variant not found'; end if;

  insert into public.negotiation_cases (
    workspace_id, source_variant_id, slug, title, summary, situation, conflict,
    user_role, opponent_role, additional_roles, stakes, start_situation,
    difficulty_reason, evaluation_focus, methodology_basis, origin, status
  )
  select
    workspace_id, id, 'case-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    title, summary, situation, conflict, user_role, opponent_role, additional_roles,
    stakes, start_situation, difficulty_reason, evaluation_focus, methodology_basis,
    p_origin, 'published'
  from public.case_variants
  where id = p_variant_id
  on conflict (source_variant_id) where source_variant_id is not null
  do update set source_variant_id = excluded.source_variant_id
  returning id into approved_id;

  update public.case_variants set approved_at = coalesce(approved_at, approved_at_value) where id = p_variant_id;
  update public.case_workspaces set status = 'approved', updated_at = approved_at_value where id = workspace_id_value;
  return approved_id;
end;
$$;

grant execute on function public.approve_case_variant(uuid, text) to service_role;

alter table public.case_media_jobs add column if not exists generation_id uuid;
alter table public.case_media_jobs add column if not exists published_generation_id uuid;
alter table public.case_comic_panels add column if not exists generation_id uuid;

insert into public.case_media_jobs (case_id, status, generation_id, published_generation_id, completed_at, updated_at)
select distinct p.case_id, 'ready', gen_random_uuid(), null, now(), now()
from public.case_comic_panels p
where not exists (select 1 from public.case_media_jobs j where j.case_id = p.case_id)
on conflict (case_id) do nothing;

update public.case_media_jobs
set generation_id = coalesce(generation_id, gen_random_uuid())
where generation_id is null and case_id in (select distinct case_id from public.case_comic_panels);

update public.case_media_jobs
set published_generation_id = generation_id
where published_generation_id is null and generation_id is not null
  and case_id in (select distinct case_id from public.case_comic_panels);

update public.case_comic_panels p
set generation_id = j.published_generation_id
from public.case_media_jobs j
where p.case_id = j.case_id and p.generation_id is null;

alter table public.case_comic_panels
  drop constraint if exists case_comic_panels_case_id_role_index_panel_index_key;
create unique index if not exists case_comic_panels_generation_unique
  on public.case_comic_panels (case_id, generation_id, role_index, panel_index)
  where generation_id is not null;

create or replace function public.claim_case_media_job(p_case_id uuid, p_force boolean default false)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare claimed_generation uuid := gen_random_uuid();
begin
  insert into public.case_media_jobs (case_id, status, updated_at)
  values (p_case_id, 'pending', now())
  on conflict (case_id) do nothing;

  update public.case_media_jobs
  set status = 'processing', error = null, generation_id = claimed_generation,
      started_at = now(), completed_at = null, updated_at = now()
  where case_id = p_case_id
    and (status in ('pending', 'failed') or (status = 'processing' and started_at < now() - interval '10 minutes') or (p_force and status = 'ready'));
  if not found then return null; end if;
  return claimed_generation;
end;
$$;

create or replace function public.complete_case_media_job(p_case_id uuid, p_generation_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.case_media_jobs
  set status = 'ready', published_generation_id = p_generation_id,
      completed_at = now(), updated_at = now(), error = null
  where case_id = p_case_id and generation_id = p_generation_id and status = 'processing';
  return found;
end;
$$;

grant execute on function public.claim_case_media_job(uuid, boolean) to service_role;
grant execute on function public.complete_case_media_job(uuid, uuid) to service_role;
