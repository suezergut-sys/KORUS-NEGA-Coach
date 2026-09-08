import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260907220000_exclude_1c_from_win_rate.sql", "utf8");

describe("рейтинг без победителя в кейсе 1С", () => {
  it("исключает кейс из числителя и знаменателя процента побед, сохраняя общий счётчик тренировок", () => {
    expect(migration).toContain("count(sessions.id)::bigint as played");
    expect(migration).toContain("sessions.case_code <> '1c-dismissal'");
    expect(migration).toMatch(/\/ count\(sessions\.id\) filter \(where sessions\.case_code <> '1c-dismissal'\)/);
  });
});
