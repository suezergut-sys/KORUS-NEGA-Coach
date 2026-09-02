import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AntiPatternsSection } from "../src/components/NegotiationReport";
import { antiPatternAnalysisInstructions, sanitizeDetectedAntiPatterns } from "../src/lib/anti-patterns";
import { negotiationAnalysisSchema } from "../src/lib/analysis-types";
import { METHODOLOGY_ATOM_DESCRIPTIONS, METHODOLOGY_ATOM_KINDS, METHODOLOGY_ATOM_LABELS } from "../src/lib/methodology-atom-kind";

const atom = { id: "anti-1", kind: "anti_pattern", title: "Давление срочностью", statement: "Не вынуждать принимать решение в спешке." };

describe("методические антиприёмы", () => {
  it("регистрирует отдельный тип с понятным названием и описанием", () => {
    expect(METHODOLOGY_ATOM_KINDS).toContain("anti_pattern");
    expect(METHODOLOGY_ATOM_LABELS.anti_pattern).toBe("Антиприём");
    expect(METHODOLOGY_ATOM_DESCRIPTIONS.find((item) => item.kind === "anti_pattern")?.description).toContain("снижает оценку");
    expect(negotiationAnalysisSchema.required).toContain("antiPatterns");
    expect(negotiationAnalysisSchema.properties.antiPatterns.maxItems).toBe(13);
  });

  it("требует дословную цитату только из реплик участника", () => {
    const detected = [{ methodologyAtomId: atom.id, name: "Выдумано", turnQuote: "Подпиши это сегодня", explanation: "Выдумано" }];
    expect(sanitizeDetectedAntiPatterns(detected, [atom], ["Подпиши это сегодня, времени нет."])).toEqual([{
      methodologyAtomId: atom.id,
      name: atom.title,
      turnQuote: "Подпиши это сегодня",
      explanation: atom.statement,
    }]);
    expect(sanitizeDetectedAntiPatterns(detected, [atom], ["Давай обсудим срок."])).toEqual([]);
    expect(antiPatternAnalysisInstructions(true)).toContain("только реплики человека");
  });

  it("не показывает пустой раздел и объясняет штраф для найденного антиприёма", () => {
    expect(renderToStaticMarkup(<AntiPatternsSection items={[]} />)).toBe("");
    const markup = renderToStaticMarkup(<AntiPatternsSection items={[{ methodologyAtomId: atom.id, name: atom.title, turnQuote: "Подпиши сегодня", explanation: atom.statement }]} />);
    expect(markup).toContain("АНТИПРИЁМЫ РУКОВОДИТЕЛЯ");
    expect(markup).toContain("на 4 балла");
    expect(markup).toContain("Подпиши сегодня");
  });
});
