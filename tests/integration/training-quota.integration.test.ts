import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const integration = url && key ? describe : describe.skip;
const db = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

integration("Supabase daily training quota contracts", () => {
  it("exposes training tiers and the one-time Realtime claim column", async () => {
    const [{ data: profiles, error: profileError }, { data: sessions, error: sessionError }] = await Promise.all([
      db!.from("user_profiles").select("id,role,training_tier").limit(1),
      db!.from("training_sessions").select("id,realtime_started_at").limit(1),
    ]);
    expect(profileError).toBeNull();
    expect(sessionError).toBeNull();
    expect(Array.isArray(profiles)).toBe(true);
    expect(Array.isArray(sessions)).toBe(true);
  }, 30_000);

  it("returns the protected administrative overview and daily quota", async () => {
    const { data: users, error: usersError } = await db!.rpc("admin_user_overview");
    expect(usersError).toBeNull();
    expect(Array.isArray(users)).toBe(true);
    const firstUser = (users || [])[0] as { id?: string; training_tier?: string } | undefined;
    expect(firstUser?.training_tier === "standard" || firstUser?.training_tier === "premium").toBe(true);

    const { data: quota, error: quotaError } = await db!.rpc("daily_training_quota", { p_user_id: firstUser!.id });
    expect(quotaError).toBeNull();
    expect(quota).toEqual(expect.arrayContaining([
      expect.objectContaining({ training_tier: firstUser!.training_tier }),
    ]));
  }, 30_000);
});
