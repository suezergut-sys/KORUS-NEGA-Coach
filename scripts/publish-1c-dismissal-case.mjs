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
const [{ data: department, error: departmentError }, { data: source, error: sourceError }, { data: negotiationCase, error: caseError }] = await Promise.all([
  db.from("departments").select("id,code,name").eq("code", "1c").single(),
  db.from("method_sources").select("id,code,methodology_version,verification_status").eq("code", "SRC-004").single(),
  db.from("negotiation_cases").select("id,slug,title,status,visibility,department_id,required_methodology_id,scenario_conditions").eq("slug", "1c-dismissal").single(),
]);
if (departmentError) throw departmentError;
if (sourceError) throw sourceError;
if (caseError) throw caseError;
if (negotiationCase.visibility !== "department" || negotiationCase.department_id !== department.id) {
  throw new Error("Кейс не привязан к департаменту 1С в режиме department.");
}
if (negotiationCase.required_methodology_id !== "dismissal_1c") {
  throw new Error("За кейсом не закреплена методология dismissal_1c.");
}
if (!negotiationCase.scenario_conditions?.some((condition) => condition.includes("не менее трёх разных содержательных возражений"))) {
  throw new Error("В кейсе не закреплено сценарное условие о трёх возражениях сотрудника.");
}
if (!negotiationCase.scenario_conditions?.some((condition) => condition.includes("двух-трёх окладов"))) {
  throw new Error("В кейсе не закреплено ожидание сотрудником двух-трёх окладов.");
}
if (!negotiationCase.scenario_conditions?.some((condition) => condition.includes("потеряет отсрочку от мобилизации"))) {
  throw new Error("В кейсе не закреплён риск потери отсрочки от мобилизации.");
}

const { count, error: atomsError } = await db
  .from("method_atoms")
  .select("id", { count: "exact", head: true })
  .eq("source_id", source.id)
  .neq("verification_status", "rejected");
if (atomsError) throw atomsError;
if ((count || 0) < 21) throw new Error("Методическая база SRC-004 заполнена не полностью.");

if (!apply) {
  console.log(JSON.stringify({ applied: false, department, source, case: negotiationCase, atomCount: count }, null, 2));
  process.exit(0);
}

const { data: published, error: publishError } = await db
  .from("negotiation_cases")
  .update({ status: "published", updated_at: new Date().toISOString() })
  .eq("id", negotiationCase.id)
  .select("id,slug,title,status,visibility,department_id,required_methodology_id,scenario_conditions")
  .single();
if (publishError) throw publishError;
const { error: mediaError } = await db.rpc("enqueue_case_media_job", { p_case_id: published.id, p_force: true });
if (mediaError) throw mediaError;

console.log(JSON.stringify({ applied: true, department, source, case: published, atomCount: count, mediaStatus: "pending" }, null, 2));
