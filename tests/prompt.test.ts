import { describe, expect, it } from "vitest";
import { buildRealtimeInstructions, type SessionInput } from "../src/lib/prompt";

const baseInput: Omit<SessionInput, "negotiationStyle"> = {
  role: "Алексей Воронцов, руководитель",
  context: "Обсуждение сроков проекта.",
  addressForm: "formal",
};

describe("стили Realtime-переговоров", () => {
  it("жёстко фиксирует русский язык и первую реплику оппонента", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative" });
    expect(prompt).toContain("полностью русскоязычный тренажёр переговоров");
    expect(prompt).toContain("Первая реплика оппонента обязательно должна быть на русском языке");
    expect(prompt).toContain("Первая реплика должна быть открытой и диагностической");
    expect(prompt).toContain("не предлагай конкретное решение, план, условия, сроки, цифры, уступки или обмены");
    expect(prompt).toContain("К рациональному обсуждению конкретных вариантов переходи только после ответа участника");
  });

  it("с первой реплики поддерживает заданную форму обращения", () => {
    const informal = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative", addressForm: "informal" });
    expect(informal).toContain("ФОРМА ОБРАЩЕНИЯ: НА «ТЫ»");
    expect(informal).toContain("С первой реплики и до конца разговора");
    expect(informal).toContain("Не переходи на «вы»");

    const formal = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative", addressForm: "formal" });
    expect(formal).toContain("ФОРМА ОБРАЩЕНИЯ: НА «ВЫ»");
    expect(formal).toContain("Не переходи на «ты»");
  });

  it("даёт жёсткому оппоненту напор и ограничивает перебивания", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "hard" });
    expect(prompt).toContain("ЖЁСТКИЕ ПЕРЕГОВОРЫ");
    expect(prompt).toContain("не чаще одного раза на пять");
  });

  it("запрещает намеренно перебивать в стиле сотрудничества", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative" });
    expect(prompt).toContain("СОТРУДНИЧЕСТВО");
    expect(prompt).toContain("Не перебивай собеседника намеренно");
  });

  it("запрещает додумывать незавершённую реплику пользователя", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative" });
    expect(prompt).toContain("не додумывай позицию, намерение или аргументы пользователя");
    expect(prompt).toContain("попроси закончить мысль");
  });

  it("не разрешает заполнять пробелы правдоподобными фактами", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative" });
    expect(prompt).toContain("ФАКТИЧЕСКАЯ ТОЧНОСТЬ ВЫШЕ РЕАЛИСТИЧНОСТИ РОЛИ");
    expect(prompt).toContain("Не придумывай причины, события, действия, ресурсы, процессы, интеграции");
    expect(prompt).toContain("не установлена или не указана");
    expect(prompt).toContain("Не приписывай пользователю согласие, слова, обязательства или намерения");
  });

  it("задаёт постепенную эмоциональную динамику без выхода из роли", () => {
    const prompt = buildRealtimeInstructions({ ...baseInput, negotiationStyle: "collaborative" });
    expect(prompt).toContain("ЭМОЦИОНАЛЬНАЯ ДИНАМИКА");
    expect(prompt).toContain("Меняй настроение постепенно и последовательно");
    expect(prompt).toContain("Не называй эмоцию или внутренние показатели вслух");
  });
});
