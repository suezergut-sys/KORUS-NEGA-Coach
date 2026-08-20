alter table public.training_sessions
  drop constraint if exists training_sessions_methodology_id_check;

alter table public.training_sessions
  add constraint training_sessions_methodology_id_check
  check (methodology_id in ('tarasov', 'harvard', 'conflicts'));

comment on constraint training_sessions_methodology_id_check on public.training_sessions is
  'Allows every methodology exposed by the negotiation trainer.';
