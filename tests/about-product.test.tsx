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
    expect(markup).toContain("Общие и кейсовые методологии");
    expect(markup).toContain("Релиз под давлением");
    expect(markup).toContain("постепенно меняет доверие, напряжение и эмоциональную окраску голоса");
    expect(markup).toContain("Весь поединок проходит строго на русском языке");
    expect(markup).toContain("готовый отчёт можно заново сформировать по другой методологии");
    expect(markup).toContain("полную стенограмму и неизменяемый первый отчёт поединка");
    expect(markup).toContain("Оппонент всегда начинает по-русски");
    expect(markup).toContain("Заметная реакция на перебивания");
    expect(markup).toContain("Надёжное различение речи и шума");
    expect(markup).toContain("Быстрый и контролируемый выпуск на Vercel");
    expect(markup).toContain("аудиозаписи до 25 МБ");
    expect(markup).toContain("Приватность, качество и управление");
    expect(markup).toContain("Выбор первой реплики и контроль старта");
    expect(markup).toContain("Переговоры без озвучки в режиме «Только текст»");
    expect(markup).toContain("Запуск тренировок с методологией конфликтов");
    expect(markup).toContain("Ведомственный кейс «1С Увольнение»");
    expect(markup).toContain("Системный кейс «1С Увольнение»");
    expect(markup).toContain("руководителя Марию Соколову");
    expect(markup).toContain("Фиксированный старт кейса «1С Увольнение»");
    expect(markup).toContain("назначает пользователю департамент");
    expect(markup).toContain("сохраняет исходные слова и порядок без продуктового перефразирования");
    expect(markup).toContain("Дословная голосовая расшифровка");
    expect(markup).toContain("Сценарные условия кейса «1С Увольнение»");
    expect(markup).toContain("минимум три разных содержательных возражения");
  });

  it("contains every merged PR in newest-first order", () => {
    expect(PRODUCT_HISTORY).toHaveLength(121);
    expect(PRODUCT_HISTORY.map((item) => item.pr)).toEqual(
      [124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, ...Array.from({ length: 61 }, (_, index) => 61 - index)],
    );
    for (let index = 1; index < PRODUCT_HISTORY.length; index += 1) {
      expect(PRODUCT_HISTORY[index - 1].date >= PRODUCT_HISTORY[index].date).toBe(true);
    }
  });

  it("groups versions by date without changing their order", () => {
    const groups = groupProductHistory();
    expect(groups[0].date).toBe("2026-08-23");
    expect(groups.at(-1)?.date).toBe("2026-07-11");
    expect(groups.flatMap((group) => group.items)).toEqual(PRODUCT_HISTORY);
  });
});
