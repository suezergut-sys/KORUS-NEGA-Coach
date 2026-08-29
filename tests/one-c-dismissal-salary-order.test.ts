import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260829120000_defer_1c_salary_objection.sql"),
  "utf8",
);

describe("1C dismissal salary objection order", () => {
  it("waits for the manager to explicitly offer one salary before objecting to it", () => {
    expect(migration).toContain("where slug = '1c-dismissal'");
    expect(migration).toContain("разрешены только после того, как руководитель");
    expect(migration).toContain("в своей завершённой реплике впервые явно озвучил предложение одного оклада");
    expect(migration).toContain("До этого момента Алексей не должен упоминать, предполагать или заранее оспаривать размер компенсации");
  });

  it("applies the same ordering rule to the opponent brief and typical objection", () => {
    expect(migration).toContain("до этого не упоминать и не предполагать размер компенсации");
    expect(migration).toContain("Только после явного предложения руководителя об одном окладе");
  });
});
