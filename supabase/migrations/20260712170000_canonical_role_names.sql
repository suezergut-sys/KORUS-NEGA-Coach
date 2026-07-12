-- Канонический кейс всегда содержит полные личные имена обеих сторон.
update public.negotiation_cases
set
  user_role = jsonb_set(
    jsonb_set(user_role, '{name}', to_jsonb('Ирина Соколова'::text)),
    '{position}', to_jsonb('Руководитель проекта'::text)
  ),
  opponent_role = jsonb_set(
    jsonb_set(opponent_role, '{name}', to_jsonb('Алексей Воронцов'::text)),
    '{position}', to_jsonb('Руководитель отдела продаж, ключевой участник проекта'::text)
  ),
  updated_at = now()
where slug = 'missed-project-deadline';
