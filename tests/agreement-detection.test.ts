import { describe, expect, it } from "vitest";
import { detectReachedAgreement, type AgreementTurn } from "../src/lib/agreement-detection";

function turns(...items: Array<[AgreementTurn["author"], string]>): AgreementTurn[] {
  return items.map(([author, text], index) => ({ id: `turn-${index + 1}`, author, text }));
}

describe("detectReachedAgreement", () => {
  it.each([
    ["Договорились: поставка в пятницу.", "Согласен, так и поступим."],
    ["Предлагаю два оклада и последний день 30 сентября.", "Да."],
    ["Я готова подписать соглашение сегодня.", "Меня такой вариант устраивает."],
    ["Давайте так и будем действовать.", "По рукам!"],
  ])("detects bilateral agreement: %s / %s", (participant, opponent) => {
    expect(detectReachedAgreement(turns(["Вы", participant], ["Оппонент", opponent]))).toEqual({
      key: "turn-1:turn-2",
      participantTurnId: "turn-1",
      opponentTurnId: "turn-2",
    });
  });

  it("works when the opponent offers terms and the participant accepts", () => {
    expect(detectReachedAgreement(turns(
      ["Оппонент", "Предлагаю закрепить срок до 15 сентября."],
      ["Вы", "Согласен."],
    ))).not.toBeNull();
  });

  it.each([
    [turns(["Вы", "Да."], ["Оппонент", "Хорошо."])],
    [turns(["Оппонент", "Вы согласны с такими условиями?"], ["Вы", "Нет, нужно обсудить сроки."])],
    [turns(["Вы", "Ну что, договорились?"], ["Оппонент", "Пока нет."])],
    [turns(["Вы", "Я согласен с этим подходом."], ["Вы", "Договорились."], ["Оппонент", "Мне нужно подумать."])],
  ])("does not report one-sided or ambiguous agreement", (dialogue) => {
    expect(detectReachedAgreement(dialogue)).toBeNull();
  });

  it("ignores system messages and agreements outside the recent context", () => {
    const dialogue = turns(
      ["Вы", "Предлагаю закрыть вопрос."],
      ["Оппонент", "Согласен."],
      ...Array.from({ length: 9 }, (_, index) => [index % 2 ? "Вы" : "Оппонент", `Обсуждаем вопрос ${index}.`] as [AgreementTurn["author"], string]),
      ["Система", "Договорились."],
    );
    expect(detectReachedAgreement(dialogue)).toBeNull();
  });
});
