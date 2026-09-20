import "server-only";

import { isPlatformAdministrator } from "@/lib/admin-access";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { SiteSession } from "@/lib/site-session";

export async function getOneCCaseCreatorAccess(session: SiteSession) {
  const db = getSupabaseAdmin();
  const { data: profile, error: profileError } = await db
    .from("user_profiles")
    .select("department_id")
    .eq("id", session.userId)
    .maybeSingle();
  if (profileError) throw new Error(`Профиль пользователя: ${profileError.message}`);

  const { data: oneCDepartment, error: departmentError } = await db
    .from("departments")
    .select("id")
    .eq("code", "1c")
    .maybeSingle();
  if (departmentError) throw new Error(`Департамент 1С: ${departmentError.message}`);

  const departmentId = oneCDepartment?.id ? String(oneCDepartment.id) : null;
  return {
    allowed: Boolean(departmentId) && (profile?.department_id === departmentId || isPlatformAdministrator(session.email)),
    departmentId,
  };
}
