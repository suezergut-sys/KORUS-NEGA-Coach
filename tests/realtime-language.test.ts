import { describe, expect, it } from "vitest";
import {
  buildFirstOpponentTurnInstructions,
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
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("собственное отношение к ситуации от первого лица");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("что может решить или что готов предложить");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).not.toContain("его приоритеты или ограничения");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("предложи ему первым изложить свою позицию");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("не предлагай конкретное решение");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("только после ответа участника");
    expect(FIRST_OPPONENT_TURN_INSTRUCTIONS).toContain("не предлагай выбрать произвольную тему");
  });

  it("повторно закрепляет владельцев целей непосредственно перед первой репликой", () => {
    const instructions = buildFirstOpponentTurnInstructions({
      participantRole: {
        name: "Дмитрий Ковалёв",
        position: "Руководитель практики бизнес-аналитики",
        publicGoal: "Завершить трудовые отношения с сотрудником.",
      },
      opponentRole: {
        name: "Леонид Башкатов",
        position: "Старший бизнес-аналитик",
        publicGoal: "Сохранить свою работу или получить компенсацию.",
      },
    });

    expect(instructions).toContain("ТЫ СЕЙЧАС: Леонид Башкатов, Старший бизнес-аналитик");
    expect(instructions).toContain("СОБЕСЕДНИК: Дмитрий Ковалёв, Руководитель практики бизнес-аналитики");
    expect(instructions).toContain("ТВОЯ ЦЕЛЬ, КОТОРАЯ ПРИНАДЛЕЖИТ ТОЛЬКО ТЕБЕ: Сохранить свою работу");
    expect(instructions).toContain("Категорически запрещено превращать твою цель в приоритет или выбор собеседника");
    expect(instructions).toContain("сотрудник не спрашивает руководителя, хочет ли руководитель сохранить свою работу");
    expect(instructions).toContain("что руководитель может объяснить или предложить со своей стороны");
  });
});
