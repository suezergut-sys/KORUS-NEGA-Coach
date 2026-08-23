import "server-only";

import { DEFAULT_CASE, DEFAULT_CASE_ID } from "@/lib/default-case";
import { mapCaseRow, type CanonicalCase } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { canAccessCase } from "@/lib/case-visibility";
import { getCaseAccessContext } from "@/lib/case-access-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export { selectCaseRoles } from "@/lib/case-role-selection";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolvePublishedCase(caseId?: string, caseCode?: string): Promise<CanonicalCase | null> {
  if (caseId === DEFAULT_CASE_ID || (!caseId && (!caseCode || caseCode === DEFAULT_CASE.slug))) return DEFAULT_CASE;
  const db = getSupabaseAdmin();
  let query = db.from("negotiation_cases").select("*").eq("status", "published");
  if (caseId) {
    if (!UUID.test(caseId)) return null;
    query = query.eq("id", caseId);
  } else if (caseCode) {
    query = query.eq("slug", caseCode.slice(0, 120));
  } else {
    return null;
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Кейс: ${error.message}`);
  if (!data) return null;
  const session = await getCurrentUserSession();
  if (!session) return null;
  return canAccessCase(data, await getCaseAccessContext(session)) ? mapCaseRow(data) : null;
}

export async function resolvePublishedCaseForAdmin(caseId?: string): Promise<CanonicalCase | null> {
  if (caseId === DEFAULT_CASE_ID) return DEFAULT_CASE;
  if (!caseId || !UUID.test(caseId)) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("negotiation_cases")
    .select("*")
    .eq("status", "published")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(`Кейс: ${error.message}`);
  return data ? mapCaseRow(data) : null;
}
