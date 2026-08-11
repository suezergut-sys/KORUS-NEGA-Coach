import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { METHODOLOGY_AUDIT, METHODOLOGY_KIND_DEFINITIONS } from "./methodology-audit-config.mjs";

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
const codes = Object.keys(METHODOLOGY_AUDIT);
const { data: sources, error: sourceError } = await db
  .from("method_sources")
  .select("id,code,title,verification_status,methodology_version")
  .in("code", codes);
if (sourceError) throw sourceError;
if (sources.length !== codes.length) throw new Error(`Ожидалось ${codes.length} источника, найдено ${sources.length}.`);

const report = [];
const now = new Date().toISOString();
const reviewerNote = "Условно верифицировано для рабочего использования после повторной классификации по пяти типам атомов 11.08.2026. Требуется последующая экспертная проверка методологом.";

for (const source of sources.sort((a, b) => a.code.localeCompare(b.code))) {
  const config = METHODOLOGY_AUDIT[source.code];
  const { data: atoms, error: atomsError } = await db
    .from("method_atoms")
    .select("id,kind,title,verification_status,methodology_version")
    .eq("source_id", source.id);
  if (atomsError) throw atomsError;
  if (atoms.length !== config.expectedAtoms) {
    throw new Error(`${source.code}: ожидалось ${config.expectedAtoms} атомов, найдено ${atoms.length}.`);
  }

  const byTitle = new Map(atoms.map((atom) => [atom.title, atom]));
  const simulatedKinds = new Map(atoms.map((atom) => [atom.id, atom.kind]));
  const pendingCorrections = [];
  for (const [title, [fromKind, toKind]] of Object.entries(config.corrections)) {
    const atom = byTitle.get(title);
    if (!atom) throw new Error(`${source.code}: не найден атом «${title}».`);
    if (atom.kind !== fromKind && atom.kind !== toKind) {
      throw new Error(`${source.code}: атом «${title}» имеет неожиданный тип ${atom.kind}.`);
    }
    simulatedKinds.set(atom.id, toKind);
    if (atom.kind !== toKind) pendingCorrections.push({ atom, fromKind, toKind });
  }

  const simulatedCounts = Object.keys(METHODOLOGY_KIND_DEFINITIONS).reduce((counts, kind) => {
    counts[kind] = [...simulatedKinds.values()].filter((value) => value === kind).length;
    return counts;
  }, {});
  if (JSON.stringify(simulatedCounts) !== JSON.stringify(config.expectedKinds)) {
    throw new Error(`${source.code}: распределение типов не совпало: ${JSON.stringify(simulatedCounts)}.`);
  }

  if (apply) {
    for (const correction of pendingCorrections) {
      const { error } = await db.from("method_atoms").update({ kind: correction.toKind }).eq("id", correction.atom.id);
      if (error) throw error;
    }
    const { error: verificationError } = await db.from("method_atoms").update({
      verification_status: "verified",
      methodology_version: config.releaseVersion,
      reviewer_note: reviewerNote,
      verified_at: now,
    }).eq("source_id", source.id);
    if (verificationError) throw verificationError;
    const { error: releaseError } = await db.from("method_sources").update({
      verification_status: "verified",
      methodology_version: config.releaseVersion,
      updated_at: now,
    }).eq("id", source.id);
    if (releaseError) throw releaseError;
  }

  report.push({
    code: source.code,
    title: source.title,
    atoms: atoms.length,
    kinds: simulatedCounts,
    corrections: pendingCorrections.map(({ atom, fromKind, toKind }) => ({ title: atom.title, fromKind, toKind })),
    releaseVersion: config.releaseVersion,
    mode: apply ? "applied" : "dry-run",
  });
}

if (apply) {
  for (const source of sources) {
    const config = METHODOLOGY_AUDIT[source.code];
    const { data: atoms, error } = await db.from("method_atoms").select("kind,verification_status,methodology_version,reviewer_note").eq("source_id", source.id);
    if (error) throw error;
    if (atoms.some((atom) => atom.verification_status !== "verified" || atom.methodology_version !== config.releaseVersion)) {
      throw new Error(`${source.code}: итоговая условная верификация не подтверждена.`);
    }
    if (atoms.some((atom) => atom.reviewer_note !== reviewerNote)) {
      throw new Error(`${source.code}: экспертная оговорка условной верификации записана не для всех атомов.`);
    }
  }
}

console.log(JSON.stringify({ applied: apply, definitions: METHODOLOGY_KIND_DEFINITIONS, sources: report }, null, 2));
