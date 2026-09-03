import type { LaborLawRisk } from "@/lib/analysis-types";

export const ONE_C_DISMISSAL_CASE_CODE = "1c-dismissal";

type LaborLawRiskReference = Omit<LaborLawRisk, "turnQuote">;

export const LABOR_LAW_RISK_REFERENCES: readonly LaborLawRiskReference[] = [
  { referenceId: "voluntary-application", dangerousPhrase: "Пиши заявление по собственному", risk: "Может выглядеть как принуждение к увольнению", articles: "ст. 77, 80, 394" },
  { referenceId: "leave-or-dismiss", dangerousPhrase: "Либо сам уйдёшь, либо мы тебя уволим", risk: "Давление, угроза, риск признания увольнения вынужденным", articles: "ст. 80, 394" },
  { referenceId: "sign-today", dangerousPhrase: "Подпиши заявление сегодня", risk: "Давление сроком, сомнение в добровольности", articles: "ст. 80" },
  { referenceId: "employer-voluntary-decision", dangerousPhrase: "Мы решили, что ты уходишь по собственному", risk: "Работодатель не может инициировать увольнение по собственному желанию работника", articles: "ст. 77, 80" },
  { referenceId: "problems-if-refusal", dangerousPhrase: "Не подпишешь — будут проблемы", risk: "Прямой риск доказывания давления", articles: "ст. 3, 80, 237, 394" },
  { referenceId: "dismiss-for-cause", dangerousPhrase: "Уволим по статье", risk: "Угроза увольнением без соблюдения процедуры", articles: "ст. 81, 192, 193" },
  { referenceId: "find-cause", dangerousPhrase: "Найдём за что уволить", risk: "Признак злоупотребления и давления", articles: "ст. 3, 81, 192, 193, 394" },
  { referenceId: "fabricate-absence", dangerousPhrase: "Оформим прогул", risk: "Риск обвинения в фабрикации основания", articles: "ст. 81 ч. 1 п. 6, ст. 193" },
  { referenceId: "reprimand-then-dismiss", dangerousPhrase: "Сделаем выговор, потом уволим", risk: "Дисциплинарные взыскания нельзя использовать как инструмент давления", articles: "ст. 192, 193" },
  { referenceId: "force-out", dangerousPhrase: "Мы всё равно тебя выживем", risk: "Риск морального вреда, давления, дискриминации или злоупотребления", articles: "ст. 3, 21, 237, 394" },
  { referenceId: "withhold-settlement", dangerousPhrase: "Не подпишешь — не получишь расчёт", risk: "Незаконное удержание выплат", articles: "ст. 84.1, 127, 140" },
  { referenceId: "delay-salary", dangerousPhrase: "Зарплату задержим", risk: "Нарушение сроков выплаты зарплаты", articles: "ст. 136, 140" },
  { referenceId: "withhold-leave-compensation", dangerousPhrase: "Компенсацию за отпуск не выплатим", risk: "Компенсация за неиспользованный отпуск обязательна", articles: "ст. 127, 140" },
  { referenceId: "remove-bonus", dangerousPhrase: "Премию заберём, если не уйдёшь", risk: "Риск незаконного лишения выплаты, если премия предусмотрена системой оплаты", articles: "ст. 135, 191" },
  { referenceId: "payments-blackmail", dangerousPhrase: "Уйдёшь тихо — заплатим, нет — ничего не получишь", risk: "Шантаж выплатами", articles: "ст. 136, 140, 237" },
  { referenceId: "age", dangerousPhrase: "Ты нам не подходишь по возрасту", risk: "Дискриминация по возрасту", articles: "ст. 3" },
  { referenceId: "young-team", dangerousPhrase: "У нас молодая команда", risk: "Косвенный признак возрастной дискриминации", articles: "ст. 3" },
  { referenceId: "after-maternity-leave", dangerousPhrase: "После декрета ты нам не нужна", risk: "Дискриминация и нарушение гарантий работникам с детьми", articles: "ст. 3, 261" },
  { referenceId: "children-performance", dangerousPhrase: "С детьми ты не сможешь нормально работать", risk: "Дискриминация по семейному положению", articles: "ст. 3" },
  { referenceId: "sick-leave", dangerousPhrase: "Ты часто болеешь, поэтому увольняем", risk: "Болезнь сама по себе не является универсальным основанием увольнения", articles: "ст. 81, 183" },
  { referenceId: "pregnancy-unwanted", dangerousPhrase: "Нам не нужны беременные", risk: "Грубое нарушение гарантий беременным", articles: "ст. 3, 261" },
  { referenceId: "protected-characteristic", dangerousPhrase: "Не подходишь по полу, национальности, религии или взглядам", risk: "Прямая дискриминация", articles: "ст. 3" },
  { referenceId: "redundancy-tomorrow", dangerousPhrase: "С завтрашнего дня твоя должность сокращена", risk: "Нарушение срока предупреждения", articles: "ст. 81 ч. 1 п. 2, ст. 180" },
  { referenceId: "backdated-notice", dangerousPhrase: "Подпиши уведомление задним числом", risk: "Риск признания процедуры незаконной", articles: "ст. 180, 394" },
  { referenceId: "no-vacancies", dangerousPhrase: "Вакансий тебе предлагать не будем", risk: "При сокращении нужно предлагать подходящие вакансии", articles: "ст. 81, 180" },
  { referenceId: "no-severance", dangerousPhrase: "Выходное пособие не положено", risk: "При сокращении предусмотрены гарантии и выплаты", articles: "ст. 178, 180" },
  { referenceId: "inconvenient-employee", dangerousPhrase: "Мы выбрали тебя, потому что ты неудобный", risk: "Риск оспаривания выбора кандидата на сокращение", articles: "ст. 179" },
  { referenceId: "fake-redundancy", dangerousPhrase: "Должность сократим, но потом возьмём другого", risk: "Риск фиктивного сокращения", articles: "ст. 81, 394" },
  { referenceId: "agreement-ready", dangerousPhrase: "Соглашение уже готово, просто подпиши", risk: "Давление, риск спора о добровольности", articles: "ст. 78, 237, 394" },
  { referenceId: "terms-not-negotiable", dangerousPhrase: "Условия не обсуждаются", risk: "В конфликтном контексте усиливает риск давления", articles: "ст. 78" },
  { referenceId: "worse-dismissal", dangerousPhrase: "Если не подпишешь соглашение, уволим хуже", risk: "Прямое давление", articles: "ст. 78, 80, 81, 237, 394" },
  { referenceId: "compensation-now", dangerousPhrase: "Компенсация будет только если подпишешь прямо сейчас", risk: "Давление срочностью", articles: "ст. 78" },
  { referenceId: "probation-do-not-return", dangerousPhrase: "Ты нам не понравился, завтра не выходи", risk: "При неудовлетворительном результате испытания нужна процедура", articles: "ст. 70, 71" },
  { referenceId: "probation-no-reasons", dangerousPhrase: "На испытательном сроке можно уволить без объяснений", risk: "Нужны причины и письменное предупреждение", articles: "ст. 71" },
  { referenceId: "pregnancy-probation", dangerousPhrase: "Беременным испытательный срок тоже ставим", risk: "Для ряда работников испытание запрещено", articles: "ст. 70" },
  { referenceId: "pregnancy-dismissal", dangerousPhrase: "Беременность не имеет значения, увольняем", risk: "У беременных есть специальные гарантии", articles: "ст. 261" },
  { referenceId: "small-child", dangerousPhrase: "Раз у тебя маленький ребёнок, нам неудобно", risk: "Риск дискриминации и нарушения гарантий", articles: "ст. 3, 261" },
  { referenceId: "no-position-after-leave", dangerousPhrase: "После отпуска по уходу места нет", risk: "Риск нарушения гарантий сохранения места работы", articles: "ст. 256, 261" },
  { referenceId: "backdated-signature", dangerousPhrase: "Подпиши задним числом", risk: "Риск фальсификации процедуры", articles: "ст. 84.1, 193, 180" },
  { referenceId: "order-later", dangerousPhrase: "Приказ потом сделаем как надо", risk: "Риск неправильного оформления увольнения", articles: "ст. 84.1" },
  { referenceId: "withhold-employment-record", dangerousPhrase: "Трудовую не отдадим", risk: "Нарушение порядка оформления прекращения работы", articles: "ст. 66.1, 84.1" },
  { referenceId: "no-explanation", dangerousPhrase: "Объяснительную писать не надо, мы и так всё решили", risk: "При дисциплинарном взыскании нужно запросить объяснение", articles: "ст. 193" },
  { referenceId: "bad-reference", dangerousPhrase: "Мы испортим тебе рекомендации", risk: "Давление, возможный моральный вред", articles: "ст. 237" },
  { referenceId: "public-disclosure", dangerousPhrase: "Расскажем всем, почему ты ушёл", risk: "Риск нарушения конфиденциальности и давления", articles: "ст. 86–90, 237" },
  { referenceId: "industry-blacklist", dangerousPhrase: "В отрасли ты больше не устроишься", risk: "Угроза и давление", articles: "ст. 237" },
];

function normalizeQuote(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[«»„“”\"'.,!?;:—–-]/g, " ").replace(/\s+/g, " ").trim();
}

export function laborLawRiskInstructions(caseCode: string) {
  if (caseCode !== ONE_C_DISMISSAL_CASE_CODE) return "Поле laborLawRisks верни пустым массивом.";
  const references = LABOR_LAW_RISK_REFERENCES.map((item) =>
    `- ${item.referenceId}: «${item.dangerousPhrase}» — ${item.risk} (${item.articles})`,
  ).join("\n");
  return `
Только для раздела laborLawRisks проверь реплики человека-руководителя на смысловое сходство с эталонами ниже. Это не юридическое заключение.
Добавляй элемент только при явном совпадении по смыслу: turnQuote скопируй дословно из реплики руководителя, referenceId и остальные поля — из одного подходящего эталона. Не считай опасной нейтральную информацию о добровольном соглашении, обязательных выплатах, сроках на обдумывание или законной процедуре без давления и угроз. Если совпадений нет, верни пустой массив.
ЭТАЛОНЫ РИСКОВ ПО ТК РФ:
${references}
  `.trim();
}

export function oneCAnalysisPriorityInstructions(caseCode: string) {
  if (caseCode !== ONE_C_DISMISSAL_CASE_CODE) return "";
  return `
Для кейса 1С сначала и особенно внимательно сформируй risks: перечисли ошибки руководителя, несоответствия методологии и потенциальные риски по ТК РФ. Если руководитель предложил письменно зафиксировать договорённости первого разговора письмом, протоколом или иным подтверждением, обязательно включи это в risks как методическую ошибку. Не считай такой ошибкой обязательные кадровые документы, которые оформляются отдельно по установленной процедуре.
Положительные наблюдения помещай в strengths и персональную обратную связь только после полного разбора рисков. Поле laborLawRisks заполняй отдельно только по правилам и эталонам ТК РФ ниже; само предложение письменной фиксации договорённостей не является автоматически риском по ТК РФ.
  `.trim();
}

export function sanitizeLaborLawRisks(caseCode: string, risks: LaborLawRisk[] | undefined, managerTurns: string[]) {
  if (caseCode !== ONE_C_DISMISSAL_CASE_CODE || !risks?.length) return [];
  const normalizedTurns = managerTurns.map(normalizeQuote).filter(Boolean);
  const references = new Map(LABOR_LAW_RISK_REFERENCES.map((item) => [item.referenceId, item]));
  const seen = new Set<string>();

  return risks.flatMap((item) => {
    const reference = references.get(item.referenceId);
    const normalizedTurnQuote = normalizeQuote(item.turnQuote || "");
    if (!reference || normalizedTurnQuote.length < 4 || !normalizedTurns.some((turn) => turn.includes(normalizedTurnQuote)) || seen.has(item.referenceId)) return [];
    seen.add(item.referenceId);
    return [{ ...reference, turnQuote: item.turnQuote.trim() }];
  }).slice(0, 10);
}
