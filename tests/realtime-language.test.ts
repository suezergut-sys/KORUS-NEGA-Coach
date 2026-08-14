import { describe, expect, it } from "vitest";
import {
  FIRST_OPPONENT_TURN_INSTRUCTIONS,
  RUSSIAN_LANGUAGE_CONTRACT,
  withRussianLanguageContract,
} from "@/lib/realtime-language";

describe("русский язык Realtime-поединка", () => {
  it("ставит обязательный языковой контракт выше локальной режиссуры", () => {
    const instructions = withRussianLanguageContract("Говори холоднее и короче.");

    expect(instructions.startsWith(RUSSIAN_LANGUAGE_CONTRACT)).toBe(true);
    expect(instructions).toContain("Говори холоднее и короче.");
  });

  it("не дублирует контракт в базовых инструкциях сессии", () => {
    const instructions = withRussianLanguageContract(`${RUSSIAN_LANGUAGE_CONTRACT}\n\nОставайся в роли.`);

    expect(instructions.match(/ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ТРЕНАЖЁРА/g)).toHaveLength(1);
  });

  it("делает первую реплику открытой и откладывает конкретные решения", () => {
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("сразу говори от лица персонажа");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("открытой и диагностической");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("предложи ему первым изложить свою позицию");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("не предлагай конкретное решение");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("только после ответа участника");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("не предлагай выбрать произвольную тему");
  });
});
