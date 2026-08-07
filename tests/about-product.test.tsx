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
    expect(markup).not.toContain("<span>01</span>");
    expect(markup).not.toContain("<span>02</span>");
    expect(markup).not.toContain("<span>03</span>");
    expect(markup).toContain("Максим Сумин");
    expect(markup).toContain("Ксения Калабушкина");
    expect(markup).toContain("Менеджер Корпоративного университета");
    expect(markup).not.toContain("Внутренний продукт");
    expect(markup).toContain("%2Fabout%2Fmaxim-sumin.png");
    expect(markup).toContain("%2Fabout%2Fksenia-kalabushkina.png");
    expect(markup).not.toContain("Платформа помогает руководителям");
    expect(markup).not.toContain("НАЗНАЧЕНИЕ ПЛАТФОРМЫ");
    expect(markup).toContain("Возможности по разделам");
    expect(markup).toContain("Тренировки с AI-оппонентом");
    expect(markup).toContain("аудиозаписи до 25 МБ");
    expect(markup).toContain("Приватность, качество и управление");
  });

  it("contains every merged PR in newest-first order", () => {
    expect(PRODUCT_HISTORY).toHaveLength(75);
    expect(PRODUCT_HISTORY.map((item) => item.pr)).toEqual(
      [78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, ...Array.from({ length: 61 }, (_, index) => 61 - index)],
    );
    for (let index = 1; index < PRODUCT_HISTORY.length; index += 1) {
      expect(PRODUCT_HISTORY[index - 1].date >= PRODUCT_HISTORY[index].date).toBe(true);
    }
  });

  it("groups versions by date without changing their order", () => {
    const groups = groupProductHistory();
    expect(groups[0].date).toBe("2026-08-07");
    expect(groups.at(-1)?.date).toBe("2026-07-11");
    expect(groups.flatMap((group) => group.items)).toEqual(PRODUCT_HISTORY);
  });
});
