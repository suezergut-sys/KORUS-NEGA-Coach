update public.negotiation_cases
set
  summary = 'Переговоры представителя «КОРУС Консалтинг» с менеджером по продажам Алексеем о прекращении трудовых отношений по соглашению сторон после восьми месяцев неудовлетворительных результатов.',
  situation = replace(
    situation,
    'Компания «Альфа»',
    '«КОРУС Консалтинг»'
  ),
  conflict = replace(
    conflict,
    'Компания считает ситуацию',
    '«КОРУС Консалтинг» считает ситуацию'
  ),
  address_form = 'informal',
  user_role = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              user_role,
              '{openingLine}',
              to_jsonb('Алексей, хочу прямо обсудить результаты твоей работы и решение компании о дальнейшем сотрудничестве. Для нас важно спокойно выслушать твою позицию и договориться о приемлемом порядке следующих шагов.'::text),
              true
            ),
            '{recommendedPhrases,0}',
            to_jsonb('Я хочу сначала понять, какие условия и риски для тебя сейчас наиболее важны.'::text),
            true
          ),
          '{forbiddenPhrases,0}',
          to_jsonb('Не пиши заявление по собственному желанию.'::text),
          true
        ),
        '{forbiddenPhrases,1}',
        to_jsonb('Если не подпишешь, мы всё равно найдём, за что тебя уволить.'::text),
        true
      ),
      '{forbiddenPhrases,2}',
      to_jsonb('Ты полностью провалил работу, и обсуждать здесь нечего.'::text),
      true
    ),
    '{forbiddenPhrases,3}',
    to_jsonb('Соглашайся сейчас, другого предложения не будет.'::text),
    true
  ),
  methodology_notes = 'Кейс основан на документе «Сложное увольнение менеджера по продажам» и адаптирован для «КОРУС Консалтинг». Стороны общаются на «ты». Оценка должна учитывать одновременно результативность, справедливость распределения ответственности и добровольность соглашения. Методология выбирается пользователем из доступных общих методик.',
  updated_at = now()
where slug = 'elm-sales-manager-dismissal';

select public.enqueue_case_media_job(id, true)
from public.negotiation_cases
where slug = 'elm-sales-manager-dismissal';
