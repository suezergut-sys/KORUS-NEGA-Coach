alter table public.negotiation_cases
  add column if not exists created_by text;

update public.negotiation_cases
set created_by = case origin
  when 'seed' then 'Системный кейс'
  when 'quick_upload' then 'Пользователь (быстрая загрузка)'
  else 'AI-конструктор'
end
where created_by is null;

alter table public.negotiation_cases
  alter column created_by set default 'AI-конструктор';

comment on column public.negotiation_cases.created_by is
  'Отображаемое имя или источник загрузки/генерации кейса для административного реестра.';
