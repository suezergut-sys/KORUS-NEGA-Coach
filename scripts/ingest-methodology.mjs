import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { XMLParser } from "fast-xml-parser";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

try {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  // CI and production provide environment variables directly.
}

const args = new Set(process.argv.slice(2));
const extractAtoms = args.has("--extract-atoms");
const sourcePath = resolve(
  process.cwd(),
  process.env.METHODOLOGY_SOURCE_PATH || "private-sources/Tarasov_Iskusstvo-upravlencheskoy-borby.fb2",
);
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
  throw new Error("Нужны SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и OPENAI_API_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const openai = new OpenAI({ apiKey: openaiKey });

function nodeText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(nodeText).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .filter(([key]) => !key.startsWith("@_"))
    .map(([, child]) => nodeText(child))
    .join(" ");
}

function directTitle(sectionNodes) {
  const titleNode = sectionNodes.find((node) => Object.hasOwn(node, "title"));
  return nodeText(titleNode?.title).replace(/\s+/g, " ").trim();
}

function collectParagraphs(nodes, sectionPath = [], output = []) {
  for (const node of nodes || []) {
    if (!node || typeof node !== "object") continue;
    for (const [key, value] of Object.entries(node)) {
      if (key === "section") {
        const sectionNodes = Array.isArray(value) ? value : [value];
        const title = directTitle(sectionNodes) || `Раздел ${sectionPath.length + 1}`;
        collectParagraphs(sectionNodes, [...sectionPath, title], output);
      } else if (key === "p" || key === "subtitle" || key === "text-author") {
        const text = nodeText(value).replace(/\s+/g, " ").trim();
        if (text.length >= 2) {
          output.push({
            sectionPath: sectionPath.length ? sectionPath.join(" → ") : "Основной текст",
            text,
          });
        }
      } else if (key !== "title" && Array.isArray(value)) {
        collectParagraphs(value, sectionPath, output);
      }
    }
  }
  return output;
}

function createChunks(paragraphs, maxChars = 3200) {
  const chunks = [];
  let buffer = [];
  let size = 0;
  let sectionPath = paragraphs[0]?.sectionPath || "Основной текст";
  let charCursor = 0;

  const flush = () => {
    if (!buffer.length) return;
    const content = buffer.map((item) => item.text).join("\n\n");
    chunks.push({
      chunk_index: chunks.length,
      section_path: sectionPath,
      content,
      char_start: charCursor,
      char_end: charCursor + content.length,
      metadata: { paragraph_count: buffer.length },
    });
    charCursor += content.length + 2;
    buffer = [];
    size = 0;
  };

  for (const paragraph of paragraphs) {
    const wouldOverflow = buffer.length && size + paragraph.text.length + 2 > maxChars;
    const sectionChanged = buffer.length && paragraph.sectionPath !== sectionPath && size > 1200;
    if (wouldOverflow || sectionChanged) flush();
    if (!buffer.length) sectionPath = paragraph.sectionPath;
    buffer.push(paragraph);
    size += paragraph.text.length + 2;
  }
  flush();
  return chunks;
}

function scoreChunk(chunk) {
  const terms = [
    "стратаг", "управленческ", "борьб", "переговор", "поедин", "стратег",
    "выигр", "проигр", "позици", "цель", "роль", "конфликт", "власть",
    "напад", "защит", "уступ", "маневр", "решени", "критери", "оцен",
  ];
  const haystack = `${chunk.section_path} ${chunk.content}`.toLocaleLowerCase("ru-RU");
  return terms.reduce((score, term) => score + (haystack.split(term).length - 1), 0);
}

function selectAtomChunks(chunks, limit = 16) {
  const ranked = [...chunks].sort((a, b) => scoreChunk(b) - scoreChunk(a));
  const selected = [];
  const sections = new Map();
  for (const chunk of ranked) {
    const count = sections.get(chunk.section_path) || 0;
    if (count >= 3) continue;
    selected.push(chunk);
    sections.set(chunk.section_path, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

const atomSchema = {
  type: "object",
  additionalProperties: false,
  required: ["atoms"],
  properties: {
    atoms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["chunkIndex", "kind", "title", "statement", "signals", "counterexamples", "sourceQuote"],
        properties: {
          chunkIndex: { type: "integer" },
          kind: { type: "string", enum: ["principle", "stratagem", "case_rule", "evaluation_criterion", "example"] },
          title: { type: "string" },
          statement: { type: "string" },
          signals: { type: "array", items: { type: "string" } },
          counterexamples: { type: "array", items: { type: "string" } },
          sourceQuote: { type: "string" },
        },
      },
    },
  },
};

async function extractCandidateAtoms(sourceId, chunks, chunkIdByIndex) {
  const selected = selectAtomChunks(chunks);
  const candidates = [];
  for (let offset = 0; offset < selected.length; offset += 2) {
    const batch = selected.slice(offset, offset + 2);
    const input = batch
      .map((chunk) => `[ФРАГМЕНТ ${chunk.chunk_index}] ${chunk.section_path}\n${chunk.content}`)
      .join("\n\n");
    const response = await openai.responses.create({
      model: process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.4-mini",
      reasoning: { effort: "low" },
      instructions: `
Извлеки только явно поддержанные текстом кандидаты в методические атомы Владимира Тарасова.
Не превращай отдельную сюжетную деталь в универсальное правило. Если явного правила нет, верни пустой массив.
sourceQuote должна быть короткой дословной цитатой из указанного фрагмента.
statement формулируй нейтрально и помечай как кандидат, который должен проверить методист.
      `.trim(),
      input,
      text: { format: { type: "json_schema", name: "method_atoms", strict: true, schema: atomSchema } },
    });
    const parsed = JSON.parse(response.output_text);
    for (const atom of parsed.atoms || []) {
      const chunk = batch.find((item) => item.chunk_index === atom.chunkIndex);
      if (!chunk || !chunk.content.includes(atom.sourceQuote)) continue;
      candidates.push({
        source_id: sourceId,
        chunk_id: chunkIdByIndex.get(chunk.chunk_index),
        kind: atom.kind,
        title: atom.title.slice(0, 240),
        statement: atom.statement,
        signals: atom.signals,
        counterexamples: atom.counterexamples,
        source_quote: atom.sourceQuote,
        methodology_version: "tarasov-v0-candidate",
        verification_status: "candidate",
      });
    }
    console.log(`Методические кандидаты: обработано ${Math.min(offset + 2, selected.length)}/${selected.length}`);
  }

  if (candidates.length) {
    const { error } = await supabase
      .from("method_atoms")
      .upsert(candidates, { onConflict: "source_id,kind,title,source_quote", ignoreDuplicates: true });
    if (error) throw error;
  }
  return candidates.length;
}

const sourceBuffer = await readFile(sourcePath);
const sha256 = createHash("sha256").update(sourceBuffer).digest("hex").toUpperCase();
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, trimValues: true, processEntities: true, htmlEntities: true });
const parsed = parser.parse(sourceBuffer.toString("utf8"));
const paragraphs = collectParagraphs(parsed);
const chunks = createChunks(paragraphs);

console.log(`Источник: ${sourcePath}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Абзацев: ${paragraphs.length}; фрагментов: ${chunks.length}`);

const storagePath = `SRC-001/${sha256}.fb2`;
const { error: uploadError } = await supabase.storage
  .from("methodology-sources")
  .upload(storagePath, sourceBuffer, { contentType: "application/xml", upsert: true });
if (uploadError) throw uploadError;

const { data: source, error: sourceError } = await supabase
  .from("method_sources")
  .upsert(
    {
      code: "SRC-001",
      author: "Владимир Тарасов",
      title: "Искусство управленческой борьбы",
      source_format: "FB2",
      sha256,
      storage_path: storagePath,
      methodology_version: "tarasov-v0-candidate",
      verification_status: "candidate",
      metadata: { paragraph_count: paragraphs.length, chunk_count: chunks.length },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sha256" },
  )
  .select("id")
  .single();
if (sourceError) throw sourceError;

const chunkIdByIndex = new Map();
for (let offset = 0; offset < chunks.length; offset += 32) {
  const batch = chunks.slice(offset, offset + 32);
  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: batch.map((chunk) => `${chunk.section_path}\n${chunk.content}`),
    encoding_format: "float",
  });
  const rows = batch.map((chunk, index) => ({
    ...chunk,
    source_id: source.id,
    embedding_model: "text-embedding-3-small",
    embedding: embeddings.data[index].embedding,
  }));
  const { data, error } = await supabase
    .from("document_chunks")
    .upsert(rows, { onConflict: "source_id,chunk_index" })
    .select("id,chunk_index");
  if (error) throw error;
  for (const row of data || []) chunkIdByIndex.set(row.chunk_index, row.id);
  console.log(`Embeddings: ${Math.min(offset + batch.length, chunks.length)}/${chunks.length}`);
}

let atomCount = 0;
if (extractAtoms) atomCount = await extractCandidateAtoms(source.id, chunks, chunkIdByIndex);

console.log(JSON.stringify({ sourceId: source.id, sha256, paragraphs: paragraphs.length, chunks: chunks.length, candidateAtoms: atomCount }, null, 2));

