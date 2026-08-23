import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const integration = url && key ? describe : describe.skip;
const db = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

integration("department-restricted case contracts", () => {
  it("contains the 1C department and nullable profile reference", async () => {
    const [{ data: departments, error: departmentError }, { data: profiles, error: profileError }] = await Promise.all([
      db!.from("departments").select("id,code,name").eq("code", "1c"),
      db!.from("user_profiles").select("id,department_id").limit(1),
    ]);
    expect(departmentError).toBeNull();
    expect(profileError).toBeNull();
    expect(departments).toEqual([expect.objectContaining({ code: "1c", name: "1С" })]);
    expect(Array.isArray(profiles)).toBe(true);
  }, 30_000);

  it("keeps the seeded case restricted and tied to its candidate methodology", async () => {
    const { data, error } = await db!.from("negotiation_cases")
      .select("slug,status,visibility,department_id,required_methodology_id,decision_terms,risk_zones")
      .eq("slug", "1c-dismissal")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      slug: "1c-dismissal",
      visibility: "department",
      required_methodology_id: "dismissal_1c",
    });
    expect(["draft", "published"]).toContain(data?.status);
    expect(data?.department_id).toBeTruthy();
    expect(data?.decision_terms).toEqual(expect.arrayContaining(["Один оклад по соглашению сторон"]));
    expect(data?.risk_zones).toEqual(expect.arrayContaining(["Понуждение к подписанию"]));
  }, 30_000);
});
