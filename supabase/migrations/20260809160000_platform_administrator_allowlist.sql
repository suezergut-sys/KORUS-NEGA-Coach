update public.user_profiles
set role = case
  when lower(email) = 'msumin@korusconsulting.ru' then 'admin'
  else 'user'
end
where role is distinct from case
  when lower(email) = 'msumin@korusconsulting.ru' then 'admin'
  else 'user'
end;

comment on column public.user_profiles.role is
  'Роль участника платформы; права администратора дополнительно проверяются по серверному списку корпоративных адресов.';
