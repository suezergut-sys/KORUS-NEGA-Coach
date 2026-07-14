import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
if (!new Set(["verify", "review"]).has(mode)) {
  throw new Error("Использование: node scripts/set-harvard-review-status.mjs verify|review");
}

function loadLocalEnv() {
  const values = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

const env = { ...loadLocalEnv(), ...process.env };
const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("В .env.local отсутствуют параметры административного подключения к Supabase.");
}

const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: source, error: sourceError } = await supabase
  .from("method_sources")
  .select("id,code,verification_status,methodology_version")
  .eq("code", "SRC-002")
  .single();
if (sourceError) throw sourceError;

const { data: atoms, error: atomsError } = await supabase
  .from("method_atoms")
  .select("id,verification_status")
  .eq("source_id", source.id);
if (atomsError) throw atomsError;
if (atoms.length !== 37) throw new Error(`Ожидалось 37 правил Гарвардского метода, найдено ${atoms.length}.`);

const now = new Date().toISOString();
const verify = mode === "verify";
const atomUpdate = verify
  ? {
      verification_status: "verified",
      methodology_version: "harvard-v1",
      reviewer_note: "Условно верифицировано для рабочего использования по решению владельца продукта 15.07.2026. Требуется последующая проверка методологом.",
      verified_at: now,
    }
  : {
      verification_status: "candidate",
      methodology_version: "harvard-v0-candidate",
      reviewer_note: "Условная верификация снята. Требуется решение методолога.",
      verified_at: null,
    };

const { error: atomUpdateError } = await supabase
  .from("method_atoms")
  .update(atomUpdate)
  .eq("source_id", source.id);
if (atomUpdateError) throw atomUpdateError;

const sourceUpdate = verify
  ? { verification_status: "verified", methodology_version: "harvard-v1", updated_at: now }
  : { verification_status: "candidate", methodology_version: "harvard-v0-candidate", updated_at: now };
const { error: sourceUpdateError } = await supabase
  .from("method_sources")
  .update(sourceUpdate)
  .eq("id", source.id);
if (sourceUpdateError) throw sourceUpdateError;

const { data: result, error: resultError } = await supabase
  .from("method_atoms")
  .select("verification_status,methodology_version")
  .eq("source_id", source.id);
if (resultError) throw resultError;

const statusCounts = result.reduce((counts, atom) => {
  counts[atom.verification_status] = (counts[atom.verification_status] || 0) + 1;
  return counts;
}, {});

console.log(JSON.stringify({
  source: "SRC-002",
  mode,
  version: sourceUpdate.methodology_version,
  statuses: statusCounts,
}, null, 2));
