alter table public.case_workspaces
  add column if not exists owner_user_id uuid references public.user_profiles(id) on delete cascade;

alter table public.negotiation_cases
  add column if not exists owner_user_id uuid references public.user_profiles(id) on delete set null,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private'));

create index if not exists case_workspaces_owner_idx
  on public.case_workspaces (owner_user_id, updated_at desc);

create index if not exists negotiation_cases_visibility_owner_idx
  on public.negotiation_cases (visibility, owner_user_id, status, created_at desc);

comment on column public.negotiation_cases.owner_user_id is
  'Владелец пользовательского кейса; null для системных и исторических кейсов.';

comment on column public.negotiation_cases.visibility is
  'public — доступен всем участникам; private — полное содержание и запуск доступны только владельцу.';

create or replace function public.approve_case_variant(
  p_variant_id uuid,
  p_origin text,
  p_owner_user_id uuid,
  p_visibility text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  approved_id uuid;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  approved_at_value timestamptz := now();
begin
  if p_origin not in ('quick_upload', 'builder') then
    raise exception 'Unsupported case origin';
  end if;
  if p_owner_user_id is null then
    raise exception 'Case owner is required';
  end if;
  if p_visibility not in ('public', 'private') then
    raise exception 'Unsupported case visibility';
  end if;

  select v.workspace_id, w.owner_user_id
    into workspace_id_value, workspace_owner_id
  from public.case_variants v
  join public.case_workspaces w on w.id = v.workspace_id
  where v.id = p_variant_id;

  if workspace_id_value is null then
    raise exception 'Case variant not found';
  end if;
  if workspace_owner_id is distinct from p_owner_user_id then
    raise exception 'Case workspace belongs to another user';
  end if;

  insert into public.negotiation_cases (
    workspace_id, source_variant_id, slug, title, summary, situation, conflict,
    user_role, opponent_role, additional_roles, stakes, start_situation,
    difficulty_reason, evaluation_focus, methodology_basis, origin, status,
    owner_user_id, visibility
  )
  select
    workspace_id, id, 'case-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    title, summary, situation, conflict, user_role, opponent_role, additional_roles,
    stakes, start_situation, difficulty_reason, evaluation_focus, methodology_basis,
    p_origin, 'published', p_owner_user_id, p_visibility
  from public.case_variants
  where id = p_variant_id
  on conflict (source_variant_id) where source_variant_id is not null
  do update set
    visibility = case
      when public.negotiation_cases.owner_user_id = p_owner_user_id then excluded.visibility
      else public.negotiation_cases.visibility
    end
  returning id into approved_id;

  update public.case_variants
  set approved_at = coalesce(approved_at, approved_at_value)
  where id = p_variant_id;

  update public.case_workspaces
  set status = 'approved', updated_at = approved_at_value
  where id = workspace_id_value and owner_user_id = p_owner_user_id;

  return approved_id;
end;
$$;

grant execute on function public.approve_case_variant(uuid, text, uuid, text) to service_role;
