import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260824120000_expand_1c_dismissal_scenario.sql"), "utf8");

describe("расширение сценария увольнения 1С", () => {
  it("меняет только системный кейс 1С", () => {
    expect(migration).toContain("where slug = '1c-dismissal'");
    expect(migration.match(/update public\.negotiation_cases/g)).toHaveLength(1);
  });

  it("закрепляет ожидание двух-трёх окладов и страх долгого поиска", () => {
    expect(migration).toContain("компенсацию в размере двух-трёх окладов");
    expect(migration).toContain("Сильно боится, что поиск новой работы займёт дольше одного месяца");
    expect(migration).toContain("одно предложение одного оклада не должно его успокоить");
  });

  it("закрепляет потерю отсрочки и мобилизационный риск", () => {
    expect(migration).toContain("После увольнения теряет отсрочку от мобилизации");
    expect(migration).toContain("при возможном скором объявлении мобилизации окажется в зоне риска");
    expect(migration).toContain("Обесценивание страха долгого поиска работы или потери отсрочки от мобилизации");
  });
});
