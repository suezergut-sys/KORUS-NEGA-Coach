import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

try {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  // CI and production provide environment variables directly.
}

const apply = process.argv.includes("--apply");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");

const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: source, error: sourceError } = await db.from("method_sources").select("id,verification_status,methodology_version").eq("code", "SRC-003").single();
if (sourceError) throw sourceError;
if (source.verification_status !== "verified" || source.methodology_version !== "conflicts-v1") {
  throw new Error("Сначала условно верифицируйте SRC-003 как conflicts-v1.");
}

const basisTitles = [
  "Переходить от «я против тебя» к «мы против проблемы»",
  "Двигаться от восприятия к интересам и только затем к действиям",
  "Отражать эмоцию и проверять понимание",
  "Прояснять ключевой интерес и потребность",
  "Проверять намерение участника конфликта",
];
const { data: atoms, error: atomError } = await db
  .from("method_atoms")
  .select("id,title,verification_status")
  .eq("source_id", source.id)
  .in("title", basisTitles);
if (atomError) throw atomError;
if (atoms.length !== basisTitles.length || atoms.some((atom) => atom.verification_status !== "verified")) {
  throw new Error("Не найдены все условно верифицированные атомы для тестового кейса.");
}
const atomByTitle = new Map(atoms.map((atom) => [atom.title, atom]));

const methodologyBasis = [
  [basisTitles[0], "Помогает сторонам отделить взаимные претензии от общей задачи — безопасно выпустить клиентский портал."],
  [basisTitles[1], "Задаёт последовательность разговора: сначала восприятие и эмоции, затем интересы, после этого конкретный план действий."],
  [basisTitles[2], "Позволяет проверить интерпретацию раздражения и снизить автоматическую защиту собеседника."],
  [basisTitles[3], "Помогает раскрыть реальные потребности за позициями «перенести запуск» и «выпустить в срок»."],
  [basisTitles[4], "Оценивает, стремится ли участник победить коллегу или решить общую проблему."],
].map(([title, application]) => ({ atomId: atomByTitle.get(title).id, title, application }));

const row = {
  slug: "conflict-release-under-pressure",
  title: "Релиз под давлением",
  summary: "Руководитель клиентского сервиса и технический директор должны решить судьбу запуска клиентского портала после провального пилота и взаимных обвинений.",
  situation: "Компания готовит запуск нового B2B-портала к отраслевой конференции через десять дней. Пилотные клиенты нашли ошибки в уведомлениях и доступности интерфейса. Маркетинговая кампания оплачена, подрядчики забронированы, а перенос нарушит обещание ключевому заказчику. После резкого совещания Марина Лебедева потребовала отложить запуск, а Тимур Хабибуллин публично заявил, что клиентский сервис слишком поздно меняет требования.",
  conflict: "Марина воспринимает отказ от переноса как пренебрежение клиентами и её профессиональной ответственностью. Тимур воспринимает эскалацию Марины как попытку переложить на разработку последствия поздних требований. За 45 минут им нужно договориться о решении, владельцах рисков и единой позиции для генерального директора, не превращая спор о запуске в борьбу друг с другом.",
  user_role: {
    name: "Марина Лебедева",
    position: "Руководитель клиентского сервиса",
    voiceGender: "female",
    publicGoal: "Добиться решения, которое не выпустит критичные клиентские дефекты и сохранит доверие заказчиков.",
    interests: ["Защитить опыт пилотных клиентов", "Сохранить доверие ключевого заказчика", "Получить ясных владельцев исправлений"],
    constraints: ["Нельзя скрывать известные дефекты", "Решение нужно представить генеральному директору через 45 минут", "Полный перенос более чем на месяц недопустим"],
    hiddenMotives: ["После публичной критики боится потерять влияние на продуктовые решения", "Хочет, чтобы Тимур признал ценность клиентских данных"],
    leverage: ["Отзывы и письма пилотных клиентов", "Право рекомендовать остановку клиентского запуска", "Поддержка директора по продажам"],
  },
  opponent_role: {
    name: "Тимур Хабибуллин",
    position: "Технический директор",
    voiceGender: "male",
    publicGoal: "Сохранить дату релиза и ограничить объём изменений до технически безопасного минимума.",
    interests: ["Не сорвать обязательства перед бизнесом", "Защитить команду от бесконечной смены требований", "Сохранить управляемую архитектуру решения"],
    constraints: ["До конференции доступно только шесть рабочих дней разработки", "Два ведущих инженера уже распределены на другой контракт", "Изменение ядра уведомлений требует повторного нагрузочного теста"],
    hiddenMotives: ["Воспринимает перенос как сомнение в компетентности своей команды", "Опасается, что признание поздней оценки рисков повредит его позиции на бюджетном комитете"],
    leverage: ["Контроль плана релиза и технических ресурсов", "Оценка трудоёмкости исправлений", "Поддержка директора по маркетингу"],
  },
  additional_roles: [],
  stakes: ["Доверие ключевого заказчика", "Репутация двух руководителей", "Стоимость маркетинговой кампании", "Устойчивость портала", "Прецедент изменения требований перед релизом"],
  start_situation: "Тимур начинает разговор: «Я не подпишу перенос из-за требований, которые ваша команда принесла за десять дней до релиза. Давайте либо фиксируем минимальный набор исправлений сегодня, либо вы лично объясняете генеральному директору, почему срываем запуск».",
  difficulty_reason: "За позициями сторон стоят разные восприятия ответственности, эмоциональная защита профессиональной роли и реальные ограничения ресурсов. Очевидный компромисс «выпустить половину» не снимает риски: стороны должны сначала прояснить уровень конфликта и интересы, а затем совместно определить допустимые дефекты, этапность и ответственность.",
  evaluation_focus: ["Отделение человека от общей проблемы", "Отражение эмоций без оценки", "Прояснение интересов и потребностей", "Переход из взаимных обвинений в позицию «взрослый — взрослый»", "Конкретный план действий и владельцы рисков"],
  methodology_basis: methodologyBasis,
  origin: "seed",
  status: "published",
  visibility: "public",
  owner_user_id: null,
  created_by: "Команда KORUS",
  updated_at: new Date().toISOString(),
};

if (!apply) {
  console.log(JSON.stringify({ applied: false, case: { slug: row.slug, title: row.title, roles: [row.user_role.name, row.opponent_role.name], methodologyBasis } }, null, 2));
  process.exit(0);
}

const { data: negotiationCase, error: caseError } = await db
  .from("negotiation_cases")
  .upsert(row, { onConflict: "slug" })
  .select("id,slug,title,status,visibility,user_role,opponent_role,methodology_basis")
  .single();
if (caseError) throw caseError;
const { error: mediaError } = await db.rpc("enqueue_case_media_job", { p_case_id: negotiationCase.id, p_force: true });
if (mediaError) throw mediaError;

console.log(JSON.stringify({ applied: true, case: negotiationCase, mediaStatus: "pending" }, null, 2));
