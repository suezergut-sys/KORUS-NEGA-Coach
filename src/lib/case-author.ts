import "server-only";

import { getCurrentUserSession } from "@/lib/user-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function getCurrentCaseAuthor(fallback: string) {
  const session = await getCurrentUserSession();
  if (!session) return fallback;
  const { data } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("first_name,last_name,email")
    .eq("id", session.userId)
    .maybeSingle();
  if (!data) return session.email || fallback;
  const fullName = `${data.first_name || ""} ${data.last_name || ""}`.replace(/\s+/g, " ").trim();
  return fullName ? `${fullName} · ${data.email || session.email}` : (data.email || session.email || fallback);
}
