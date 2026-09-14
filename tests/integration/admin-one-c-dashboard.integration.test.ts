import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const integration = url && key ? describe : describe.skip;
const db = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

integration("admin 1C dashboard RPC", () => {
  it("returns only 1C users in surname order with valid aggregates", async () => {
    const { data: department, error: departmentError } = await db!.from("departments").select("id").eq("code", "1c").single();
    expect(departmentError).toBeNull();
    const [{ data: expected, error: profilesError }, { data: rows, error: dashboardError }] = await Promise.all([
      db!.from("user_profiles").select("id").eq("department_id", department!.id).order("last_name").order("first_name"),
      db!.rpc("admin_one_c_dashboard"),
    ]);

    expect(profilesError).toBeNull();
    expect(dashboardError).toBeNull();
    expect(((rows || []) as Array<{ id: string }>).map((row) => row.id)).toEqual((expected || []).map((row) => row.id));
    for (const row of (rows || []) as Array<{ played_cases: number | string; average_score: number | string | null }>) {
      expect(Number(row.played_cases)).toBeGreaterThanOrEqual(0);
      if (row.average_score !== null) {
        expect(Number(row.average_score)).toBeGreaterThanOrEqual(0);
        expect(Number(row.average_score)).toBeLessThanOrEqual(100);
      }
    }
  }, 30_000);
});
