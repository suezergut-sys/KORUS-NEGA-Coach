alter table public.negotiation_cases
  add column if not exists required_participant_role_index smallint,
  add column if not exists required_first_speaker text;

alter table public.negotiation_cases
  drop constraint if exists negotiation_cases_required_participant_role_index_check;

alter table public.negotiation_cases
  add constraint negotiation_cases_required_participant_role_index_check
  check (required_participant_role_index is null or required_participant_role_index between 0 and 3);

alter table public.negotiation_cases
  drop constraint if exists negotiation_cases_required_first_speaker_check;

alter table public.negotiation_cases
  add constraint negotiation_cases_required_first_speaker_check
  check (required_first_speaker is null or required_first_speaker in ('participant', 'opponent'));

comment on column public.negotiation_cases.required_participant_role_index is
  'Необязательный индекс роли, которую участник обязан играть в системном кейсе.';
comment on column public.negotiation_cases.required_first_speaker is
  'Необязательная обязательная сторона первой реплики: participant или opponent.';

update public.negotiation_cases
set
  user_role = jsonb_set(user_role, '{name}', to_jsonb('Мария Соколова'::text), true),
  required_participant_role_index = 0,
  required_first_speaker = 'participant',
  updated_at = now()
where slug = '1c-dismissal';
