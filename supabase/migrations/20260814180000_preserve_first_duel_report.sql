alter table public.evaluations
  add column if not exists initial_result jsonb,
  add column if not exists initial_methodology_id text,
  add column if not exists initial_methodology_version text,
  add column if not exists initial_overall_score integer;

update public.evaluations as evaluation
set
  initial_result = coalesce(evaluation.initial_result, evaluation.result),
  initial_methodology_id = coalesce(evaluation.initial_methodology_id, session.methodology_id),
  initial_methodology_version = coalesce(evaluation.initial_methodology_version, evaluation.methodology_version),
  initial_overall_score = coalesce(evaluation.initial_overall_score, evaluation.overall_score)
from public.training_sessions as session
where session.id = evaluation.session_id
  and (
    evaluation.initial_result is null
    or evaluation.initial_methodology_id is null
    or evaluation.initial_methodology_version is null
    or evaluation.initial_overall_score is null
  );

alter table public.evaluations
  alter column initial_result set not null,
  alter column initial_methodology_id set not null,
  alter column initial_methodology_version set not null;

alter table public.evaluations
  drop constraint if exists evaluations_initial_overall_score_check,
  add constraint evaluations_initial_overall_score_check
    check (initial_overall_score between 0 and 100);

comment on column public.evaluations.initial_result is
  'Immutable first successfully generated report for the duel.';
