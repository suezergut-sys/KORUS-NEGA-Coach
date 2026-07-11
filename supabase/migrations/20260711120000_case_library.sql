create table if not exists public.case_workspaces (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Новый кейс',
  notes text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'analyzed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.case_workspaces(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  storage_path text,
  extracted_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists case_materials_workspace_idx
  on public.case_materials (workspace_id, created_at);

create table if not exists public.case_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.case_workspaces(id) on delete cascade,
  title text not null,
  summary text not null,
  situation text not null,
  conflict text not null,
  user_role jsonb not null,
  opponent_role jsonb not null,
  stakes jsonb not null default '[]'::jsonb,
  start_situation text not null,
  difficulty_reason text not null,
  evaluation_focus jsonb not null default '[]'::jsonb,
  methodology_basis jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists case_variants_workspace_idx
  on public.case_variants (workspace_id, created_at desc);

create table if not exists public.negotiation_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.case_workspaces(id) on delete set null,
  source_variant_id uuid references public.case_variants(id) on delete set null,
  slug text not null unique,
  title text not null,
  summary text not null,
  situation text not null,
  conflict text not null,
  user_role jsonb not null,
  opponent_role jsonb not null,
  stakes jsonb not null default '[]'::jsonb,
  start_situation text not null,
  difficulty_reason text not null,
  evaluation_focus jsonb not null default '[]'::jsonb,
  methodology_basis jsonb not null default '[]'::jsonb,
  origin text not null default 'builder'
    check (origin in ('seed', 'quick_upload', 'builder')),
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists negotiation_cases_status_idx
  on public.negotiation_cases (status, created_at desc);

alter table public.training_sessions
  add column if not exists case_id uuid references public.negotiation_cases(id) on delete set null;

create index if not exists training_sessions_case_idx
  on public.training_sessions (case_id, created_at desc);

alter table public.case_workspaces enable row level security;
alter table public.case_materials enable row level security;
alter table public.case_variants enable row level security;
alter table public.negotiation_cases enable row level security;

grant all on public.case_workspaces to service_role;
grant all on public.case_materials to service_role;
grant all on public.case_variants to service_role;
grant all on public.negotiation_cases to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-materials',
  'case-materials',
  false,
  4194304,
  array[
    'text/plain', 'text/markdown', 'text/csv', 'text/xml', 'text/html', 'text/rtf',
    'application/json', 'application/xml', 'application/rtf',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.negotiation_cases (
  slug, title, summary, situation, conflict, user_role, opponent_role,
  stakes, start_situation, difficulty_reason, evaluation_focus,
  methodology_basis, origin, status
)
values (
  'missed-project-deadline',
  'Сорванный срок проекта',
  'Разговор руководителя проекта с сильным сотрудником после срыва ключевого этапа внедрения CRM.',
  'Компания «Альтаир» внедряет новую CRM. Ключевой этап проекта сорван, а заказчик требует назвать ответственного и компенсировать задержку.',
  'Руководителю нужно восстановить управляемость проекта и добиться принятия ответственности, но прямое давление может привести к потере ключевого специалиста и ещё большему срыву.',
  '{"name":"Руководитель проекта","position":"Руководитель проекта","publicGoal":"Сохранить рабочие отношения, добиться признания ответственности и согласовать реалистичный план исправления ситуации.","interests":["Восстановить срок проекта","Сохранить доверие заказчика","Не потерять ключевого специалиста"],"constraints":["Нельзя перекладывать ответственность на заказчика","Срок восстановления — не более 10 рабочих дней","Ключевого сотрудника желательно сохранить"],"hiddenMotives":[],"leverage":["Распределение ресурсов проекта","Оценка результатов сотрудника"]}'::jsonb,
  '{"name":"Алексей, руководитель отдела продаж","position":"Ключевой участник проекта","publicGoal":"Избежать персонального обвинения и сохранить влияние на решения по внедрению.","interests":["Сохранить репутацию","Не принимать нереалистичный срок","Получить дополнительные ресурсы"],"constraints":["Не готов единолично отвечать за системный сбой"],"hiddenMotives":["Опасается, что признание вины ослабит его позицию в компании"],"leverage":["Уникальная экспертиза","Поддержка части команды"]}'::jsonb,
  '["Отношения с заказчиком","Срок внедрения","Репутация руководителя и сотрудника"]'::jsonb,
  'Оппонент начинает с отрицания личной ответственности и требует признать системный характер проблемы.',
  'Интересы сторон частично совпадают, но распределение ответственности, ресурсов и репутационных потерь не допускает очевидного взаимовыгодного решения.',
  '["Управление позицией","Выяснение интересов","Работа с ответственностью","Конкретность договорённостей"]'::jsonb,
  '[]'::jsonb,
  'seed',
  'published'
)
on conflict (slug) do nothing;
