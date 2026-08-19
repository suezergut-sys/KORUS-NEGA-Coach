import "server-only";

import { isPlatformAdministrator } from "@/lib/admin-access";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { mapDailyTrainingQuota, type DailyTrainingQuotaRow } from "@/lib/training-quota";

export async function getDailyTrainingQuota(userId: string, email?: string | null) {
  const { data, error } = await getSupabaseAdmin().rpc("daily_training_quota", { p_user_id: userId });
  if (error) throw new Error(`Не удалось проверить дневной лимит тренировок: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return mapDailyTrainingQuota(row as DailyTrainingQuotaRow | null, isPlatformAdministrator(email));
}
