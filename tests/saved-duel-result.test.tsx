import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SavedTranscript from "../src/components/SavedTranscript";

const accountPage = readFileSync(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
const analysisRoute = readFileSync(new URL("../src/app/api/analysis/route.ts", import.meta.url), "utf8");
const userStats = readFileSync(new URL("../src/lib/user-stats.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260814180000_preserve_first_duel_report.sql", import.meta.url), "utf8");

describe("сохранённый результат поединка", () => {
  it("делает результат в истории ссылкой со всплывающей подсказкой", () => {
    expect(accountPage).toContain('title="Стенограмма и отчёт"');
    expect(accountPage).toContain('href={`/account/sessions/${duel.id}`} className={`duel-result');
  });

  it("сохраняет первый отчёт отдельно и не перезаписывает его при повторном анализе", () => {
    expect(migration).toContain("initial_result = coalesce(evaluation.initial_result, evaluation.result)");
    expect(migration).toContain("alter column initial_result set not null");
    expect(analysisRoute).toContain("storedEvaluation?.initial_result || existing || analysis");
    expect(analysisRoute).toContain("storedEvaluation?.initial_methodology_id");
    expect(userStats).toContain("evaluation.initial_result || evaluation.result");
  });

  it("показывает сохранённые реплики в исходном порядке и с понятными авторами", () => {
    const markup = renderToStaticMarkup(<SavedTranscript opponentName="Марина Лебедева" turns={[
      { id: 1, sequence: 1, speaker: "opponent", text: "С чего вы хотели бы начать?", spokenAt: null },
      { id: 2, sequence: 2, speaker: "user", text: "Сначала обозначу свои интересы.", spokenAt: null },
    ]} />);
    expect(markup).toContain("Диалог поединка");
    expect(markup).toContain("Марина Лебедева");
    expect(markup).toContain("С чего вы хотели бы начать?");
    expect(markup).toContain("Вы");
    expect(markup.indexOf("С чего вы хотели бы начать?")).toBeLessThan(markup.indexOf("Сначала обозначу свои интересы."));
  });
});
