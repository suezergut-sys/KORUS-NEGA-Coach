alter table public.case_variants
  add column if not exists negotiation_pairs jsonb not null default '[]'::jsonb;

alter table public.negotiation_cases
  add column if not exists negotiation_pairs jsonb not null default '[]'::jsonb;

with variant_pairs as (
  select variant.id, jsonb_agg(jsonb_build_object(
    'roleAIndex', role_a,
    'roleBIndex', role_b,
    'reason', 'У ролей есть прямой предмет переговоров и несовместимые интересы.'
  ) order by role_a, role_b) as value
  from public.case_variants variant
  cross join lateral generate_series(0, jsonb_array_length(variant.additional_roles)) role_a
  cross join lateral generate_series(role_a + 1, 1 + jsonb_array_length(variant.additional_roles)) role_b
  where jsonb_array_length(variant.negotiation_pairs) = 0
  group by variant.id
)
update public.case_variants variant
set negotiation_pairs = pairs.value
from variant_pairs pairs
where variant.id = pairs.id
  and jsonb_array_length(variant.negotiation_pairs) = 0;

with case_pairs as (
  select negotiation_case.id, jsonb_agg(jsonb_build_object(
    'roleAIndex', role_a,
    'roleBIndex', role_b,
    'reason', 'У ролей есть прямой предмет переговоров и несовместимые интересы.'
  ) order by role_a, role_b) as value
  from public.negotiation_cases negotiation_case
  cross join lateral generate_series(0, jsonb_array_length(negotiation_case.additional_roles)) role_a
  cross join lateral generate_series(role_a + 1, 1 + jsonb_array_length(negotiation_case.additional_roles)) role_b
  where jsonb_array_length(negotiation_case.negotiation_pairs) = 0
  group by negotiation_case.id
)
update public.negotiation_cases negotiation_case
set negotiation_pairs = pairs.value
from case_pairs pairs
where negotiation_case.id = pairs.id
  and jsonb_array_length(negotiation_case.negotiation_pairs) = 0;

update public.negotiation_cases
set negotiation_pairs = jsonb_build_array(
  jsonb_build_object(
    'roleAIndex', 0,
    'roleBIndex', 1,
    'reason', 'Руководитель практики должен согласовать с сотрудником условия и форму завершения трудовых отношений.'
  ),
  jsonb_build_object(
    'roleAIndex', 1,
    'roleBIndex', 2,
    'reason', 'Сотрудник и HRBP должны согласовать законную процедуру расставания, компенсацию и снижение риска спора.'
  )
)
where title = 'Непростое увольнение'
  and jsonb_array_length(additional_roles) = 1;

update public.negotiation_cases
set negotiation_pairs = jsonb_build_array(
  jsonb_build_object('roleAIndex', 0, 'roleBIndex', 1, 'reason', 'Сотрудник и специалист отдела кадров должны установить ответственность за пропавший документ и способ исправить недоплату.'),
  jsonb_build_object('roleAIndex', 0, 'roleBIndex', 2, 'reason', 'Сотрудник и заведующий кафедрой должны договориться о повторном оформлении документов и восстановлении полной оплаты.'),
  jsonb_build_object('roleAIndex', 1, 'roleBIndex', 2, 'reason', 'Отдел кадров и заведующий кафедрой должны распределить ответственность и согласовать повторное оформление без нарушения процедуры.')
)
where title = 'Пропавший лист приема и недоплата в первую зарплату'
  and jsonb_array_length(additional_roles) = 1;

update public.negotiation_cases
set negotiation_pairs = jsonb_build_array(
  jsonb_build_object('roleAIndex', 0, 'roleBIndex', 1, 'reason', 'Сотрудник и директор должны согласовать сроки, условия и критерии повышения.'),
  jsonb_build_object('roleAIndex', 0, 'roleBIndex', 2, 'reason', 'Сотрудник и менеджер по развитию должны договориться о приемлемом пилоте вместо немедленного повышения.'),
  jsonb_build_object('roleAIndex', 1, 'roleBIndex', 2, 'reason', 'Директор и менеджер по развитию должны согласовать безопасный для бизнеса формат и критерии пилотного допуска.')
)
where title = 'Повышение сейчас или пилотный допуск к роли'
  and jsonb_array_length(additional_roles) = 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'case_variants_negotiation_pairs_array') then
    alter table public.case_variants
      add constraint case_variants_negotiation_pairs_array
      check (jsonb_typeof(negotiation_pairs) = 'array' and jsonb_array_length(negotiation_pairs) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'negotiation_cases_negotiation_pairs_array') then
    alter table public.negotiation_cases
      add constraint negotiation_cases_negotiation_pairs_array
      check (jsonb_typeof(negotiation_pairs) = 'array' and jsonb_array_length(negotiation_pairs) > 0);
  end if;
end;
$$;

comment on column public.negotiation_cases.negotiation_pairs is
  'Допустимые неориентированные пары ролей с прямым предметом переговоров; индексы соответствуют user_role, opponent_role и additional_roles.';

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
    user_role, opponent_role, additional_roles, negotiation_pairs, stakes, start_situation,
    difficulty_reason, evaluation_focus, methodology_basis, origin, status,
    owner_user_id, visibility
  )
  select
    workspace_id, id, 'case-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    title, summary, situation, conflict, user_role, opponent_role, additional_roles, negotiation_pairs,
    stakes, start_situation, difficulty_reason, evaluation_focus, methodology_basis,
    p_origin, 'published', p_owner_user_id, p_visibility
  from public.case_variants
  where id = p_variant_id
  on conflict (source_variant_id) where source_variant_id is not null
  do update set
    negotiation_pairs = excluded.negotiation_pairs,
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
