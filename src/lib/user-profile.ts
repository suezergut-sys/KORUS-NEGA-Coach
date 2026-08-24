import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function getUserFullName(userId: string, fallback = "Пользователь") {
  const { data } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("first_name,last_name")
    .eq("id", userId)
    .maybeSingle();
  const fullName = `${data?.first_name || ""} ${data?.last_name || ""}`.replace(/\s+/g, " ").trim();
  return fullName || fallback;
}
