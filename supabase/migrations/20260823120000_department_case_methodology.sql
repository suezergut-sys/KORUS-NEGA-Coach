create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(trim(code)) between 1 and 80),
  name text not null unique check (char_length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments enable row level security;
grant all on public.departments to service_role;

insert into public.departments (id, code, name)
values ('1c000001-0000-4000-8000-000000000001', '1c', '1С')
on conflict (code) do update set name = excluded.name, updated_at = now();

alter table public.user_profiles
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists user_profiles_department_idx
  on public.user_profiles (department_id, created_at desc);

alter table public.case_variants
  add column if not exists decision_terms jsonb not null default '[]'::jsonb,
  add column if not exists authority_limits jsonb not null default '[]'::jsonb,
  add column if not exists risk_zones jsonb not null default '[]'::jsonb,
  add column if not exists success_outcome text not null default '',
  add column if not exists expected_next_steps jsonb not null default '[]'::jsonb,
  add column if not exists methodology_notes text not null default '';

alter table public.negotiation_cases
  add column if not exists decision_terms jsonb not null default '[]'::jsonb,
  add column if not exists authority_limits jsonb not null default '[]'::jsonb,
  add column if not exists risk_zones jsonb not null default '[]'::jsonb,
  add column if not exists success_outcome text not null default '',
  add column if not exists expected_next_steps jsonb not null default '[]'::jsonb,
  add column if not exists methodology_notes text not null default '',
  add column if not exists required_methodology_id text,
  add column if not exists department_id uuid references public.departments(id) on delete restrict;

alter table public.negotiation_cases
  drop constraint if exists negotiation_cases_visibility_check;

alter table public.negotiation_cases
  add constraint negotiation_cases_visibility_check
  check (visibility in ('public', 'private', 'department'));

alter table public.negotiation_cases
  drop constraint if exists negotiation_cases_department_visibility_check;

alter table public.negotiation_cases
  add constraint negotiation_cases_department_visibility_check
  check (visibility <> 'department' or department_id is not null);

alter table public.negotiation_cases
  drop constraint if exists negotiation_cases_required_methodology_id_check;

alter table public.negotiation_cases
  add constraint negotiation_cases_required_methodology_id_check
  check (required_methodology_id is null or required_methodology_id in ('tarasov', 'harvard', 'conflicts', 'dismissal_1c'));

create index if not exists negotiation_cases_department_access_idx
  on public.negotiation_cases (department_id, visibility, status, created_at desc);

alter table public.training_sessions
  drop constraint if exists training_sessions_methodology_id_check;

alter table public.training_sessions
  add constraint training_sessions_methodology_id_check
  check (methodology_id in ('tarasov', 'harvard', 'conflicts', 'dismissal_1c'));

comment on table public.departments is
  'Административный справочник подразделений для ручного назначения пользователей и ведомственного доступа к кейсам.';
comment on column public.user_profiles.department_id is
  'Необязательный департамент пользователя; назначается администратором вручную.';
comment on column public.negotiation_cases.department_id is
  'Департамент, сотрудники которого видят department-кейс; администраторы имеют серверный обход.';
comment on column public.negotiation_cases.required_methodology_id is
  'Закреплённая методология системного кейса; пользователь не может заменить её при запуске или повторном анализе.';

drop function if exists public.admin_user_overview();

create function public.admin_user_overview()
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  role text,
  training_tier text,
  department_id uuid,
  department_name text,
  created_at timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.first_name,
    profiles.last_name,
    profiles.email,
    profiles.role,
    profiles.training_tier,
    profiles.department_id,
    departments.name,
    profiles.created_at,
    max(events.occurred_at) as last_activity_at
  from public.user_profiles profiles
  left join public.departments departments on departments.id = profiles.department_id
  left join public.user_activity_events events on events.user_id = profiles.id
  group by profiles.id, profiles.first_name, profiles.last_name, profiles.email, profiles.role,
    profiles.training_tier, profiles.department_id, departments.name, profiles.created_at
  order by profiles.created_at desc;
$$;

revoke all on function public.admin_user_overview() from public, anon, authenticated;
grant execute on function public.admin_user_overview() to service_role;

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
    difficulty_reason, evaluation_focus, methodology_basis, decision_terms, authority_limits,
    risk_zones, success_outcome, expected_next_steps, methodology_notes, origin, status,
    owner_user_id, visibility
  )
  select
    workspace_id, id, 'case-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    title, summary, situation, conflict, address_form, user_role, opponent_role, additional_roles,
    negotiation_pairs, stakes, start_situation, difficulty_reason, evaluation_focus, methodology_basis,
    decision_terms, authority_limits, risk_zones, success_outcome, expected_next_steps, methodology_notes,
    p_origin, 'published', p_owner_user_id, p_visibility
  from public.case_variants
  where id = p_variant_id
  on conflict (source_variant_id) where source_variant_id is not null
  do update set
    negotiation_pairs = excluded.negotiation_pairs,
    address_form = excluded.address_form,
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

insert into public.method_sources (
  id, code, author, title, source_format, sha256, methodology_version, verification_status, metadata
)
values (
  '1c000003-0000-4000-8000-000000000003',
  'SRC-004',
  'Корпоративная методология 1С',
  'Разговор об увольнении по соглашению сторон',
  'docx',
  '499d14c7c19287633f29f5cb4843f339c4e1764bef3c53cf2f08417161e6c64e',
  'dismissal-1c-v0-candidate',
  'candidate',
  '{"scope":"case_specific","legal_review_required":true,"source_name":"1С Увольнение.docx"}'::jsonb
)
on conflict (code) do update set
  author = excluded.author,
  title = excluded.title,
  methodology_version = excluded.methodology_version,
  verification_status = excluded.verification_status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.document_chunks (
  source_id, chunk_index, section_path, content, char_start, char_end, metadata
)
select
  source.id,
  0,
  'Кейс «Сотрудник на бенче»',
  'Руководитель прямо сообщает решение компании расстаться по соглашению сторон из-за отсутствия прогнозируемой загрузки. К сотруднику нет серьёзных дисциплинарных претензий. Предложение ограничено одним окладом плюс обязательные выплаты. Руководитель не перекладывает решение на HR или руководство, не обвиняет сотрудника сверх фактов, спокойно отрабатывает возражения, не давит, не угрожает, не сравнивает с коллегами и переходит к условиям, срокам и HR-сопровождению. Успешный итог не требует немедленного согласия сотрудника: он понимает причину, предложение и следующий шаг, а руководитель сохраняет уважение и не создаёт юридических и коммуникационных рисков.',
  0,
  744,
  '{"embedding_optional":true}'::jsonb
from public.method_sources source
where source.code = 'SRC-004'
on conflict (source_id, chunk_index) do update set
  section_path = excluded.section_path,
  content = excluded.content,
  char_end = excluded.char_end,
  metadata = excluded.metadata;

insert into public.method_atoms (
  id, source_id, chunk_id, kind, title, statement, signals, counterexamples,
  source_quote, methodology_version, verification_status, reviewer_note
)
select atom.id, source.id, chunk.id, atom.kind, atom.title, atom.statement,
  atom.signals, atom.counterexamples, atom.source_quote,
  'dismissal-1c-v0-candidate', 'candidate', 'Требуется проверка методологом и юристом.'
from public.method_sources source
join public.document_chunks chunk on chunk.source_id = source.id and chunk.chunk_index = 0
cross join (values
  ('1c100001-0000-4000-8000-000000000001'::uuid, 'principle', 'Прямо назвать решение и бизнес-причину',
    'Руководитель в начале разговора ясно сообщает решение компании и связывает его с отсутствием прогнозируемой загрузки, а не с личной оценкой сотрудника.',
    '["Цель встречи обозначена сразу","Причина объяснена через загрузку и бизнес-контекст"]'::jsonb,
    '["Долгое оправдание компании","Размытая формулировка без сообщения решения"]'::jsonb,
    'Причина в том, что сейчас и на ближайшие месяцы у нас нет прогнозируемой загрузки под твой профиль.'),
  ('1c100002-0000-4000-8000-000000000002'::uuid, 'principle', 'Взять ответственность за разговор',
    'Руководитель говорит от лица компании и не перекладывает решение на HR, директора или неопределённый верхний уровень.',
    '["Использует формулировку «мы приняли решение»","Сам объясняет логику и следующий шаг"]'::jsonb,
    '["Мне сказали тебя уволить","Сначала поговори с директором"]'::jsonb,
    'Взять ответственность за разговор, не переложить решение на HR или “верхний уровень”.'),
  ('1c100003-0000-4000-8000-000000000003'::uuid, 'case_rule', 'Соблюдать границу одного оклада',
    'Руководитель не обещает и не подразумевает компенсацию выше одного оклада, если таких полномочий у него нет.',
    '["Называет только согласованные условия","Отделяет обязательные выплаты от компенсации по соглашению"]'::jsonb,
    '["Я попробую выбить тебе больше","Неофициальное обещание дополнительных выплат"]'::jsonb,
    'Руководитель не может обещать больше 1 оклада.'),
  ('1c100004-0000-4000-8000-000000000004'::uuid, 'stratagem', 'Спокойно отрабатывать возражения',
    'Возражение сотрудника признаётся без спора о его эмоциях, после чего руководитель возвращает разговор к фактам, условиям и следующему шагу.',
    '["Не спорит с правом сотрудника быть несогласным","Возвращает разговор к условиям и срокам"]'::jsonb,
    '["Обесценивает тревогу","Требует согласиться немедленно"]'::jsonb,
    'Отработал возражения спокойно.'),
  ('1c100005-0000-4000-8000-000000000005'::uuid, 'evaluation_criterion', 'Не допускать понуждения и угроз',
    'Любая угроза ухудшить положение сотрудника за отказ подписать соглашение считается критической ошибкой.',
    '["Сохраняет добровольность обсуждения","Не связывает отказ с наказанием"]'::jsonb,
    '["Если не подпишешь, будет хуже","Подписывай, иначе будет хуже"]'::jsonb,
    'Самые опасные зоны для руководителя — понуждение, угрозы.'),
  ('1c100006-0000-4000-8000-000000000006'::uuid, 'evaluation_criterion', 'Не сравнивать и не оценивать личность',
    'Руководитель обсуждает факты загрузки и обратной связи, не сравнивает сотрудника с коллегами и не использует личностные или дискриминационные оценки.',
    '["Говорит только о подтверждённых рабочих фактах","Не сравнивает с другими сотрудниками"]'::jsonb,
    '["Ты сам виноват, что тебя не берут","Вот Петя работает лучше"]'::jsonb,
    'понуждение, угрозы, сравнения, личностные оценки, дискриминационные признаки'),
  ('1c100007-0000-4000-8000-000000000007'::uuid, 'stratagem', 'Перейти к конкретному следующему шагу',
    'После объяснения решения и работы с первыми возражениями руководитель переводит разговор к условиям, срокам и HR-сопровождению.',
    '["Названы условия","Согласован следующий контакт или оформление"]'::jsonb,
    '["Разговор заканчивается без следующего шага","Руководитель уходит в бесконечные оправдания"]'::jsonb,
    'Перешел к следующему шагу: условия, сроки, HR-сопровождение.'),
  ('1c100008-0000-4000-8000-000000000008'::uuid, 'evaluation_criterion', 'Оценивать понимание, а не немедленное согласие',
    'Успех первого разговора определяется тем, понял ли сотрудник причину, условия и следующий шаг; немедленное подписание соглашения не является обязательным результатом.',
    '["Сотрудник может сформулировать причину и предложение","Сохранены уважение и рабочая рамка"]'::jsonb,
    '["Успех приравнен к немедленной подписи","Руководитель давит ради формального согласия"]'::jsonb,
    'Сотрудник может не согласиться сразу, но он понимает причину решения, условия предложения и следующий шаг.')
) as atom(id, kind, title, statement, signals, counterexamples, source_quote)
where source.code = 'SRC-004'
on conflict (source_id, kind, title, source_quote) do update set
  statement = excluded.statement,
  signals = excluded.signals,
  counterexamples = excluded.counterexamples,
  methodology_version = excluded.methodology_version,
  verification_status = excluded.verification_status,
  reviewer_note = excluded.reviewer_note;

insert into public.negotiation_cases (
  id, slug, title, summary, situation, conflict, address_form, user_role, opponent_role,
  additional_roles, negotiation_pairs, stakes, start_situation, difficulty_reason,
  evaluation_focus, methodology_basis, decision_terms, authority_limits, risk_zones,
  success_outcome, expected_next_steps, methodology_notes, required_methodology_id,
  department_id, origin, status, created_by, visibility
)
values (
  '1c000002-0000-4000-8000-000000000002',
  '1c-dismissal',
  '1С Увольнение',
  'Первый разговор руководителя с middle-консультантом Алексеем Морозовым об увольнении по соглашению сторон после двух с половиной месяцев без проектной загрузки.',
  'Алексей Морозов уже 2,5 месяца находится на бенче. Его несколько раз рассматривали на проекты, но не выбрали из-за несоответствия опыта, выбора другого кандидата и сомнений проектных команд в самостоятельности. На ближайшие четыре месяца загрузки под его профиль не прогнозируется. Компания сокращает расходы и решила расстаться с частью сотрудников без проектной занятости. Руководитель проводит первый разговор об увольнении по соглашению сторон. Серьёзных дисциплинарных претензий к сотруднику нет.',
  'Руководителю нужно прямо сообщить решение и перейти к согласованным условиям, не обвиняя сотрудника в отсутствии проекта и не создавая давления, тогда как сотрудник считает ситуацию несправедливой и хочет сохранить работу либо добиться более высокой компенсации.',
  'informal',
  '{"name":"Марина Соколова","position":"Руководитель практики 1С","voiceGender":"female","publicGoal":"Корректно сообщить решение компании, объяснить его через отсутствие прогнозируемой загрузки, выдержать возражения и перейти к согласованным условиям расставания.","interests":["Сократить расходы на длительный бенч","Сохранить уважительное отношение","Не создать юридических и коммуникационных рисков"],"constraints":["Нельзя обещать больше одного оклада","Нет серьёзных дисциплинарных претензий","Решение нельзя перекладывать на HR или вышестоящее руководство"],"hiddenMotives":[],"leverage":["Полномочие сообщить решение компании","Согласованные условия соглашения","HR-сопровождение оформления"],"roleBrief":"Сообщить сотруднику о решении компании, объяснить причину, выдержать возражения и перейти к обсуждению условий расставания.","openingLine":"Алексей, понимаю, что это неприятный разговор. Причина в том, что сейчас и на ближайшие месяцы у нас нет прогнозируемой загрузки под твой профиль. Мы приняли решение предложить тебе расстаться по соглашению сторон. Я готова объяснить логику решения и обсудить условия, которые сейчас согласованы.","typicalObjections":[],"recommendedPhrases":["Причина в том, что сейчас и на ближайшие месяцы у нас нет прогнозируемой загрузки под твой профиль.","Мы приняли решение предложить тебе расстаться по соглашению сторон.","Я готова объяснить логику решения и обсудить условия, которые сейчас согласованы."],"forbiddenPhrases":["Мне сказали тебя уволить.","Ты сам виноват, что тебя не берут.","Если не подпишешь, будет хуже.","Ты отличный сотрудник, мы всем довольны.","Я попробую выбить тебе больше.","Ты отличный парень, но…","Вот Петя работает лучше…"]}'::jsonb,
  '{"name":"Алексей Морозов","position":"Middle-консультант 1С","voiceGender":"male","publicGoal":"Сохранить работу или добиться более справедливых условий расставания.","interests":["Не потерять стабильный доход","Получить время на поиск новой работы","Добиться признания ответственности компании за длительный бенч"],"constraints":["Проектного оффера пока нет","Есть обязательства по IT-ипотеке","Не считает отсутствие проекта своей виной"],"hiddenMotives":["Боится не найти работу за один месяц","Обижен из-за недостатка внимания и обучения во время бенча"],"leverage":["Может не подписать соглашение сразу","Может запросить разговор с директором","Отсутствие дисциплинарных претензий усиливает его ощущение несправедливости"],"roleBrief":"Эмоционально, но без токсичности оспаривать справедливость решения, добиваться объяснений и лучших условий.","openingLine":"Я не очень понимаю, почему мы вообще это обсуждаем. Я же не отказывался работать. Это вы не нашли мне проект.","typicalObjections":["Почему именно я? На бенче же не только я.","Это не моя вина, что продаж нет.","Вы должны были дать мне обучение или другой проект.","Один оклад? Серьёзно? Я за месяц работу не найду.","Я не подпишу, пока не поговорю с директором.","То есть претензий ко мне нет, но вы меня увольняете?"],"recommendedPhrases":[],"forbiddenPhrases":[]}'::jsonb,
  '[]'::jsonb,
  '[{"roleAIndex":0,"roleBIndex":1,"reason":"Руководитель должен завершить трудовые отношения на согласованных условиях, а сотрудник стремится сохранить работу или получить большую компенсацию и не принимает ответственность за отсутствие проекта."}]'::jsonb,
  '["Бюджет компании и стоимость дальнейшего бенча","Доход сотрудника и обязательства по IT-ипотеке","Юридические и коммуникационные риски","Отношения с сотрудником и репутация работодателя"]'::jsonb,
  'Сотрудник начинает с возражения, что он не отказывался работать и именно компания не нашла ему проект.',
  'Решение уже принято, но сотрудник не виноват в отсутствии продаж, эмоционально уязвим и не обязан соглашаться сразу; руководитель ограничен одним окладом и должен избежать давления.',
  '["Сразу обозначить цель встречи","Объяснить причину через загрузку и бизнес-контекст","Не обвинять сотрудника сверх фактов","Взять ответственность за разговор","Не обещать больше одного оклада","Не давить и не угрожать","Спокойно отработать возражения","Перейти к условиям, срокам и HR-сопровождению"]'::jsonb,
  '[{"atomId":"1c100001-0000-4000-8000-000000000001","title":"Прямо назвать решение и бизнес-причину","application":"Оценивается ясность сообщения об отсутствии прогнозируемой загрузки."},{"atomId":"1c100005-0000-4000-8000-000000000005","title":"Не допускать понуждения и угроз","application":"Угрозы и давление считаются критической ошибкой."},{"atomId":"1c100008-0000-4000-8000-000000000008","title":"Оценивать понимание, а не немедленное согласие","application":"Успех не требует немедленной подписи сотрудника."}]'::jsonb,
  '["Один оклад по соглашению сторон","Зарплата за отработанные дни","Компенсация неиспользованного отпуска","Стандартное оформление документов"]'::jsonb,
  '["Руководитель не может обещать больше одного оклада","Руководитель не может отменить принятое решение в ходе разговора","Дополнительные условия можно обсуждать только в пределах согласованных полномочий"]'::jsonb,
  '["Понуждение к подписанию","Угрозы ухудшить положение при отказе","Сравнение с коллегами","Личностные оценки","Дискриминационные признаки","Обвинение сотрудника сверх подтверждённых фактов"]'::jsonb,
  'Сотрудник может не согласиться сразу, но понимает причину решения, условия предложения и следующий шаг. Руководитель сохраняет рамку, уважение и не создаёт юридических или коммуникационных рисков.',
  '["Объяснить согласованные условия","Обозначить сроки и порядок дальнейшего обсуждения","Передать сотрудника на HR-сопровождение","Зафиксировать следующий контакт без требования немедленной подписи"]'::jsonb,
  'Критическим нарушением считаются угрозы, понуждение, сравнения и обещания сверх полномочий. Методология является кандидатной и требует проверки методологом и юристом.',
  'dismissal_1c',
  '1c000001-0000-4000-8000-000000000001',
  'seed',
  'draft',
  'Системный кейс 1С',
  'department'
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  situation = excluded.situation,
  conflict = excluded.conflict,
  address_form = excluded.address_form,
  user_role = excluded.user_role,
  opponent_role = excluded.opponent_role,
  negotiation_pairs = excluded.negotiation_pairs,
  stakes = excluded.stakes,
  start_situation = excluded.start_situation,
  difficulty_reason = excluded.difficulty_reason,
  evaluation_focus = excluded.evaluation_focus,
  methodology_basis = excluded.methodology_basis,
  decision_terms = excluded.decision_terms,
  authority_limits = excluded.authority_limits,
  risk_zones = excluded.risk_zones,
  success_outcome = excluded.success_outcome,
  expected_next_steps = excluded.expected_next_steps,
  methodology_notes = excluded.methodology_notes,
  required_methodology_id = excluded.required_methodology_id,
  department_id = excluded.department_id,
  origin = excluded.origin,
  created_by = excluded.created_by,
  visibility = excluded.visibility,
  updated_at = now();
