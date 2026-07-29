import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const integration = url && key ? describe : describe.skip;
const db = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

integration("Supabase P2 contracts", () => {
  it("executes the paginated rating RPC", async () => {
    const { data, error } = await db!.rpc("get_rating_page", {
      p_requesting_user_id: null,
      p_limit: 2,
      p_offset: 0,
      p_sort: "played",
      p_descending: true,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data || []).length).toBeLessThanOrEqual(2);
  }, 30_000);

  it("exposes consent and retention columns", async () => {
    const { data, error } = await db!
      .from("user_profiles")
      .select("transcript_consent_at,transcript_retention_days,data_policy_version")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  }, 30_000);
});
