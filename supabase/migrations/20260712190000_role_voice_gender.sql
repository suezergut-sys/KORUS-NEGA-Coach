-- Пол персонажа используется только для автоматического выбора голоса ИИ.
update public.negotiation_cases
set
  user_role = jsonb_set(user_role, '{voiceGender}', '"female"'::jsonb, true),
  opponent_role = jsonb_set(opponent_role, '{voiceGender}', '"male"'::jsonb, true),
  updated_at = now()
where slug = 'missed-project-deadline';
