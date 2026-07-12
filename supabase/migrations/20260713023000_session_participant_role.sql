alter table public.training_sessions
  add column if not exists participant_role_name text;

comment on column public.training_sessions.participant_role_name is
  'Имя роли участника в поединке; для старых сессий может быть восстановлено только в двухстороннем кейсе.';
