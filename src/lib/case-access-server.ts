import "server-only";

import { isPlatformAdministrator } from "@/lib/admin-access";
import type { CaseAccessContext } from "@/lib/case-visibility";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { SiteSession } from "@/lib/site-session";

export async function getCaseAccessContext(session: SiteSession): Promise<CaseAccessContext> {
  const { data, error } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("department_id")
    .eq("id", session.userId)
    .maybeSingle();
  if (error) throw new Error(`Профиль пользователя: ${error.message}`);
  return {
    userId: session.userId,
    departmentId: data?.department_id || null,
    isAdministrator: isPlatformAdministrator(session.email),
  };
}
