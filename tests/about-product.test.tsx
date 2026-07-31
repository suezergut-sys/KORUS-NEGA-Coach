import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage from "../src/app/about/page";
import { groupProductHistory, PRODUCT_HISTORY, PRODUCT_SECTIONS } from "../src/lib/about-product";

describe("about product page", () => {
  it("describes the complete service by section", () => {
    expect(PRODUCT_SECTIONS).toHaveLength(8);
    const markup = renderToStaticMarkup(<AboutPage />);
    expect(markup).toContain("О программе");
    expect(markup).toContain("Функциональность");
    expect(markup).toContain("История изменений");
    expect(markup).toContain("Максим Сумин");
    expect(markup).toContain("Corpus Consulting");
    expect(markup).toContain("%2Fabout%2Fmaxim-sumin.png");
    expect(markup).toContain("Возможности по разделам");
    expect(markup).toContain("Тренировки с AI-оппонентом");
    expect(markup).toContain("Приватность, качество и управление");
  });

  it("contains every merged PR in newest-first order", () => {
    expect(PRODUCT_HISTORY).toHaveLength(58);
    expect(PRODUCT_HISTORY.map((item) => item.pr)).toEqual(
      Array.from({ length: 58 }, (_, index) => 58 - index),
    );
    for (let index = 1; index < PRODUCT_HISTORY.length; index += 1) {
      expect(PRODUCT_HISTORY[index - 1].date >= PRODUCT_HISTORY[index].date).toBe(true);
    }
  });

  it("groups versions by date without changing their order", () => {
    const groups = groupProductHistory();
    expect(groups[0].date).toBe("2026-07-31");
    expect(groups.at(-1)?.date).toBe("2026-07-11");
    expect(groups.flatMap((group) => group.items)).toEqual(PRODUCT_HISTORY);
  });
});
