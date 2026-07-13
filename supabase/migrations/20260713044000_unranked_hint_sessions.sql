alter table public.training_sessions
  add column if not exists is_ranked boolean not null default true;

create index if not exists training_sessions_ranked_user_ended_idx
  on public.training_sessions (is_ranked, user_id, ended_at desc);

comment on column public.training_sessions.is_ranked is
  'false для поединков, в которых участник воспользовался AI-подсказкой; такие сессии не входят в личную статистику и рейтинг.';
