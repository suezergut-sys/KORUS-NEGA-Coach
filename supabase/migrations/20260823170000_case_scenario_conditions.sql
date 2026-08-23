alter table public.case_variants
  add column if not exists scenario_conditions jsonb not null default '[]'::jsonb;

alter table public.negotiation_cases
  add column if not exists scenario_conditions jsonb not null default '[]'::jsonb;

comment on column public.case_variants.scenario_conditions is
  'Обязательные условия развития учебного сценария; для кейсов без условий хранится пустой массив.';
comment on column public.negotiation_cases.scenario_conditions is
  'Обязательные условия развития учебного сценария; передаются AI-оппоненту и показываются в подробном описании кейса.';

update public.negotiation_cases
set
  scenario_conditions = jsonb_build_array(
    'Алексей Морозов должен высказать не менее трёх разных содержательных возражений против своего увольнения в ходе разговора и не принимать условия расставания раньше третьего возражения.'
  ),
  updated_at = now()
where slug = '1c-dismissal';

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
  if p_origin not in ('quick_upload', 'builder') then raise exception 'Unsupported case origin'; end if;
  if p_owner_user_id is null then raise exception 'Case owner is required'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'Unsupported case visibility'; end if;

  select v.workspace_id, w.owner_user_id into workspace_id_value, workspace_owner_id
  from public.case_variants v
  join public.case_workspaces w on w.id = v.workspace_id
  where v.id = p_variant_id;

  if workspace_id_value is null then raise exception 'Case variant not found'; end if;
  if workspace_owner_id is distinct from p_owner_user_id then raise exception 'Case workspace belongs to another user'; end if;

  insert into public.negotiation_cases (
    workspace_id, source_variant_id, slug, title, summary, situation, conflict, address_form,
    user_role, opponent_role, additional_roles, negotiation_pairs, stakes, start_situation,
    difficulty_reason, evaluation_focus, methodology_basis, scenario_conditions, decision_terms,
    authority_limits, risk_zones, success_outcome, expected_next_steps, methodology_notes, origin,
    status, owner_user_id, visibility
  )
  select
    workspace_id, id, 'case-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    title, summary, situation, conflict, address_form, user_role, opponent_role, additional_roles,
    negotiation_pairs, stakes, start_situation, difficulty_reason, evaluation_focus, methodology_basis,
    scenario_conditions, decision_terms, authority_limits, risk_zones, success_outcome,
    expected_next_steps, methodology_notes, p_origin, 'published', p_owner_user_id, p_visibility
  from public.case_variants
  where id = p_variant_id
  on conflict (source_variant_id) where source_variant_id is not null
  do update set
    negotiation_pairs = excluded.negotiation_pairs,
    address_form = excluded.address_form,
    scenario_conditions = excluded.scenario_conditions,
    decision_terms = excluded.decision_terms,
    authority_limits = excluded.authority_limits,
    risk_zones = excluded.risk_zones,
    success_outcome = excluded.success_outcome,
    expected_next_steps = excluded.expected_next_steps,
    methodology_notes = excluded.methodology_notes,
    visibility = case when public.negotiation_cases.owner_user_id = p_owner_user_id then excluded.visibility else public.negotiation_cases.visibility end
  returning id into approved_id;

  update public.case_variants set approved_at = coalesce(approved_at, approved_at_value) where id = p_variant_id;
  update public.case_workspaces set status = 'approved', updated_at = approved_at_value
  where id = workspace_id_value and owner_user_id = p_owner_user_id;
  return approved_id;
end;
$$;

grant execute on function public.approve_case_variant(uuid, text, uuid, text) to service_role;
