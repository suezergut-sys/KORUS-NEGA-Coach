import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260814144000_case_address_form.sql", "utf8");

describe("case address form migration", () => {
  it("stores only formal or informal values and copies them on approval", () => {
    expect(sql).toContain("address_form in ('formal', 'informal')");
    expect(sql).toContain("title, summary, situation, conflict, address_form");
    expect(sql).toContain("address_form = excluded.address_form");
  });

  it("sets Непростое увольнение to informal", () => {
    expect(sql).toContain("where title = 'Непростое увольнение'");
    expect(sql.match(/set address_form = 'informal'/g)).toHaveLength(2);
  });
});
