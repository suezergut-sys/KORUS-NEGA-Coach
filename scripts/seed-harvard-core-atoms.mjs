import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

try {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  // CI and production provide environment variables directly.
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: source, error: sourceError } = await supabase.from("method_sources").select("id").eq("code", "SRC-002").single();
if (sourceError) throw sourceError;
const { data: chunks, error: chunksError } = await supabase.from("document_chunks").select("id,chunk_index,content").eq("source_id", source.id);
if (chunksError) throw chunksError;
const chunkByIndex = new Map(chunks.map((item) => [item.chunk_index, item]));

// Remove only records damaged by a terminal encoding mismatch during the first seed attempt.
const { error: cleanupError } = await supabase.from("method_atoms").delete().eq("source_id", source.id).like("title", "%?%");
if (cleanupError) throw cleanupError;

const candidates = [
  {
    chunk: 14,
    kind: "principle",
    title: "Использовать объективные критерии",
    statement: "Кандидат: при конфликте интересов соглашение следует искать на основе объективных критериев, а не через давление сторон друг на друга.",
    signals: ["Предлагается рыночный показатель, прецедент, экспертная оценка или иной нейтральный стандарт", "Критерий используется для обоснования решения"],
    counterexamples: ["Ссылка только на собственное желание или авторитет", "Требование уступки без проверяемого основания"],
    source_quote: "вести переговоры независимо от самолюбия каждой из сторон – то есть на основе объективных критериев",
  },
  {
    chunk: 14,
    kind: "evaluation_criterion",
    title: "Проверять независимость и взаимную применимость критерия",
    statement: "Кандидат: объективный критерий должен не зависеть от желаний участников и одинаково применяться к обеим сторонам.",
    signals: ["Критерий можно применить симметрично", "Результат критерия не задаётся заранее одной из сторон"],
    counterexamples: ["Стандарт выгоден только предложившей его стороне", "Критерий меняется после получения невыгодного результата"],
    source_quote: "они должны быть независимы от желаний всех участников переговоров и применимы к обеим сторонам",
  },
  {
    chunk: 15,
    kind: "principle",
    title: "Искать объективный критерий совместно",
    statement: "Кандидат: сторона должна быть открыта к нейтральным стандартам, предложенным собеседником, и совместно выбирать наиболее подходящий критерий.",
    signals: ["Обсуждаются несколько возможных стандартов", "Предложенный другой стороной критерий оценивается по существу"],
    counterexamples: ["Объективными объявляются только собственные критерии", "Стандарт отвергается лишь из-за авторства другой стороны"],
    source_quote: "вы не должны утверждать, что эти критерии могут быть только вашими",
  },
  {
    chunk: 7,
    kind: "stratagem",
    title: "Демонстрировать активное слушание",
    statement: "Кандидат: нужно показать другой стороне, что её услышали, уточняя и своими словами проверяя понимание сказанного.",
    signals: ["Уточняющие вопросы", "Перефразирование позиции собеседника", "Проверка правильности понимания"],
    counterexamples: ["Формальное молчание без реакции на смысл", "Перебивание ради подготовки собственного аргумента"],
    source_quote: "дать ей понять, что вы ее слышите",
  },
  {
    chunk: 7,
    kind: "stratagem",
    title: "Дать другой стороне выразить эмоции",
    statement: "Кандидат: предоставление собеседнику возможности выпустить пар без перебивания и встречных возражений помогает снизить напряжение и выявить основания конфликта.",
    signals: ["Собеседнику дают закончить эмоциональное высказывание", "После снижения напряжения стороны возвращаются к проблеме"],
    counterexamples: ["Ответная эмоциональная атака", "Игнорирование угроз безопасности или оскорблений"],
    source_quote: "Предоставьте другой стороне возможность выпустить пар",
  },
  {
    chunk: 9,
    kind: "case_rule",
    title: "Излагать интересы и аргументы до предложения",
    statement: "Кандидат: чтобы доводы были услышаны, сначала следует раскрыть интересы и основания, а затем формулировать итоговое предложение.",
    signals: ["До предложения объясняется потребность и её основание", "Предложение явно связано с заявленными интересами"],
    counterexamples: ["Ультиматум без объяснения интересов", "Аргументы добавляются только после отказа"],
    source_quote: "сначала выскажите свои интересы и аргументы и лишь затем переходите к заключительным предложениям",
  },
  {
    chunk: 7,
    kind: "principle",
    title: "Сохранять лицо другой стороне",
    statement: "Кандидат: формулировка соглашения должна позволять участникам принять его без унижения, согласуя решение с их принципами и самооценкой.",
    signals: ["Решение представлено как справедливое и последовательное", "Признаны значимые принципы и вклад другой стороны"],
    counterexamples: ["Публичное требование признать поражение", "Унижение используется как условие соглашения"],
    source_quote: "приведя их в соответствие с принципами и самооценкой всех участников",
  },
];

const rows = candidates.map(({ chunk, ...atom }) => ({
  ...atom,
  source_id: source.id,
  chunk_id: chunkByIndex.get(chunk)?.id,
  methodology_version: "harvard-v0-candidate",
  verification_status: "candidate",
}));
for (const row of rows) {
  const content = chunks.find((chunk) => chunk.id === row.chunk_id)?.content || "";
  if (!content.includes(row.source_quote)) throw new Error(`Цитата не найдена в исходном фрагменте: ${row.title}`);
}
const { data, error } = await supabase
  .from("method_atoms")
  .upsert(rows, { onConflict: "source_id,kind,title,source_quote", ignoreDuplicates: true })
  .select("id,title");
if (error) throw error;
console.log(JSON.stringify({ seeded: data.length, titles: data.map((item) => item.title) }, null, 2));
