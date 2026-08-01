import { describe, expect, it } from "vitest";
import { evaluateUserTurn, isIncompleteUserTurn, shouldContinueOpponentAfterPause } from "@/lib/realtime-turn-gate";

describe("ручной допуск ответа Realtime-оппонента", () => {
  it.each(["Я", "Ну", "Потому что", "Я думаю", "Мы хотели", "Я говорю про"])(
    "не отвечает на незавершённый фрагмент %s",
    (text) => expect(isIncompleteUserTurn(text)).toBe(true),
  );

  it.each(["Да", "Нет", "Согласен", "Не согласна", "Я готов", "Дайте подумать", "Это дорого"])(
    "сохраняет короткий, но законченный ответ %s",
    (text) => expect(isIncompleteUserTurn(text)).toBe(false),
  );

  it("объединяет продолжение с ожидающим фрагментом перед допуском ответа", () => {
    expect(evaluateUserTurn(["Я"], "не согласен с этими условиями")).toEqual({
      combinedText: "Я не согласен с этими условиями",
      shouldRespond: true,
    });
  });

  it("не продолжает после паузы технически активный, но ещё не слышимый ответ", () => {
    expect(shouldContinueOpponentAfterPause({ opponentWasAudible: false, responseInProgress: true })).toBe(false);
    expect(shouldContinueOpponentAfterPause({ opponentWasAudible: true, responseInProgress: true })).toBe(true);
  });
});
