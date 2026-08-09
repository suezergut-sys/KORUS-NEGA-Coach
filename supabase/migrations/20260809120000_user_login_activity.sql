alter table public.user_activity_events
  drop constraint if exists user_activity_events_event_type_check;

alter table public.user_activity_events
  add constraint user_activity_events_event_type_check
  check (event_type in (
    'case_played',
    'case_uploaded',
    'case_created',
    'user_registered',
    'feedback_submitted',
    'duel_analyzed',
    'user_logged_in'
  ));

comment on column public.user_activity_events.event_type is
  'Тип пользовательского действия, включая успешный вход user_logged_in.';
