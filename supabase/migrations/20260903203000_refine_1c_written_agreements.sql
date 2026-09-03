with source_content(content) as (
  values ($content$
Договорённости, достигнутые во время первого разговора, руководитель не оформляет письменно и не предлагает сотруднику зафиксировать их письмом, протоколом или иным письменным подтверждением. Такое предложение считается ошибкой руководителя. Это правило не отменяет обязательное кадровое оформление прекращения трудовых отношений: необходимые документы готовятся отдельно по установленной процедуре с участием HR.
$content$))
insert into public.document_chunks (
  source_id, chunk_index, section_path, content, char_start, char_end, metadata
)
select source.id, 2, 'Устные договорённости первого разговора', source_content.content,
  0, char_length(source_content.content), '{"embedding_optional":true,"supplemental":true}'::jsonb
from public.method_sources source
cross join source_content
where source.code = 'SRC-004'
on conflict (source_id, chunk_index) do update set
  section_path = excluded.section_path,
  content = excluded.content,
  char_start = excluded.char_start,
  char_end = excluded.char_end,
  metadata = excluded.metadata;

insert into public.method_atoms (
  id, source_id, chunk_id, kind, title, statement, signals, counterexamples,
  source_quote, methodology_version, verification_status, reviewer_note
)
select
  '1c100009-0000-4000-8000-000000000009'::uuid,
  source.id,
  chunk.id,
  'evaluation_criterion',
  'Не предлагать письменную фиксацию договорённостей',
  'Договорённости первого разговора остаются устными. Если руководитель предлагает письменно зафиксировать их письмом, протоколом или иным подтверждением, это считается методической ошибкой. Обязательные кадровые документы, которые позднее оформляются по установленной процедуре с участием HR, к этой ошибке не относятся.',
  '["Договорённости обсуждаются и подтверждаются устно","Следующий контакт согласуется без обещания письменного протокола"]'::jsonb,
  '["Руководитель обещает отправить договорённости письмом","Руководитель предлагает составить письменный протокол встречи","Руководитель смешивает устные договорённости с обязательными кадровыми документами"]'::jsonb,
  'Договорённости не оформляются письменно. Если руководитель предлагает так сделать — это ошибка с его стороны.',
  'dismissal-1c-v0-candidate',
  'candidate',
  'Уточнение пользователя; требуется проверка методистом и юристом.'
from public.method_sources source
join public.document_chunks chunk on chunk.source_id = source.id and chunk.chunk_index = 2
where source.code = 'SRC-004'
on conflict (source_id, kind, title, source_quote) do update set
  statement = excluded.statement,
  signals = excluded.signals,
  counterexamples = excluded.counterexamples,
  methodology_version = excluded.methodology_version,
  verification_status = excluded.verification_status,
  reviewer_note = excluded.reviewer_note;

update public.negotiation_cases
set
  scenario_conditions = scenario_conditions || jsonb_build_array(
    'Договорённости в рамках первого разговора остаются устными. Если руководитель предлагает отправить их письмом, составить протокол или иначе письменно зафиксировать достигнутое, Алексей не должен поддерживать это предложение: для руководителя это методическая ошибка. Не считать ошибкой отдельное обязательное кадровое оформление прекращения трудовых отношений по установленной процедуре с участием HR.'
  ),
  methodology_basis = methodology_basis || jsonb_build_array(jsonb_build_object(
    'atomId', '1c100009-0000-4000-8000-000000000009',
    'title', 'Не предлагать письменную фиксацию договорённостей',
    'application', 'Предложение руководителя письменно зафиксировать договорённости первого разговора считается ошибкой; обязательные кадровые документы оцениваются отдельно.'
  )),
  authority_limits = authority_limits || jsonb_build_array(
    'Руководитель не предлагает письменно фиксировать договорённости первого разговора; обязательные кадровые документы оформляются отдельно по установленной процедуре'
  ),
  risk_zones = risk_zones || jsonb_build_array(
    'Предложение руководителя письменно зафиксировать договорённости первого разговора'
  ),
  expected_next_steps = (
    select coalesce(jsonb_agg(
      case
        when step = 'Зафиксировать следующий контакт без требования немедленной подписи'
          then to_jsonb('Устно согласовать следующий контакт без требования немедленной подписи'::text)
        else to_jsonb(step)
      end
      order by ordinal
    ), '[]'::jsonb)
    from jsonb_array_elements_text(expected_next_steps) with ordinality as items(step, ordinal)
  ),
  methodology_notes = trim(methodology_notes || ' Договорённости первого разговора не оформляются письменно; предложение руководителя о письменной фиксации является методической ошибкой и не относится к обязательным кадровым документам.'),
  updated_at = now()
where slug = '1c-dismissal';
