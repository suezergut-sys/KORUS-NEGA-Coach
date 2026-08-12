import { describe, expect, it } from "vitest";
import {
  buildOpponentEmotionInstructions,
  createInitialOpponentEmotion,
  updateOpponentEmotion,
} from "../src/lib/opponent-emotion";

describe("эмоциональная динамика голосового оппонента", () => {
  it("начинает жёсткий стиль более напряжённо и доминантно", () => {
    const collaborative = createInitialOpponentEmotion("collaborative");
    const hard = createInitialOpponentEmotion("hard");

    expect(hard.tension).toBeGreaterThan(collaborative.tension);
    expect(hard.dominance).toBeGreaterThan(collaborative.dominance);
    expect(hard.trust).toBeLessThan(collaborative.trust);
  });

  it("теплеет после уважительного конкретного предложения", () => {
    const initial = createInitialOpponentEmotion("collaborative");
    const update = updateOpponentEmotion(initial, {
      transcript: "Спасибо, я понимаю вашу позицию. Предлагаю зафиксировать срок до 15 числа и бюджет 500 тысяч рублей.",
      interruptedOpponent: false,
      style: "collaborative",
    });

    expect(update.triggers).toEqual(expect.arrayContaining(["respect", "concrete_offer"]));
    expect(update.state.trust).toBeGreaterThan(initial.trust);
    expect(update.state.tension).toBeLessThan(initial.tension);
    expect(update.state.engagement).toBeGreaterThan(initial.engagement);
  });

  it("эскалирует после ультиматума и перебивания", () => {
    const initial = createInitialOpponentEmotion("hard");
    const update = updateOpponentEmotion(initial, {
      transcript: "Вы обязаны согласиться немедленно, иначе сделка закрыта.",
      interruptedOpponent: true,
      style: "hard",
    });

    expect(update.triggers).toEqual(expect.arrayContaining(["pressure", "interruption"]));
    expect(update.state.trust).toBeLessThan(initial.trust);
    expect(update.state.tension).toBeGreaterThan(initial.tension);
    expect(update.state.irritation).toBeGreaterThan(initial.irritation);
    expect(update.state.tension - initial.tension).toBeLessThanOrEqual(18);
    expect(update.state.irritation - initial.irritation).toBeLessThanOrEqual(18);
  });

  it("делает первое перебивание слышимым и усиливает повторное", () => {
    const initial = createInitialOpponentEmotion("collaborative");
    const first = updateOpponentEmotion(initial, {
      transcript: "Предлагаю обсудить срок до пятницы.",
      interruptedOpponent: true,
      style: "collaborative",
    });
    const second = updateOpponentEmotion(first.state, {
      transcript: "Давайте сразу зафиксируем бюджет.",
      interruptedOpponent: true,
      style: "collaborative",
    });

    expect(first.state.tone).toBe("guarded");
    expect(second.state.tone).toBe("irritated");
  });

  it("снижает раздражение постепенно после извинения и уступки", () => {
    const escalated = {
      trust: 18,
      tension: 82,
      irritation: 78,
      dominance: 82,
      engagement: 35,
      tone: "angry" as const,
    };
    const update = updateOpponentEmotion(escalated, {
      transcript: "Извините, я не хотел переходить на давление. Согласен пойти навстречу по срокам.",
      interruptedOpponent: false,
      style: "collaborative",
    });

    expect(update.triggers).toEqual(expect.arrayContaining(["apology", "concession"]));
    expect(update.state.trust).toBeGreaterThan(escalated.trust);
    expect(update.state.irritation).toBeLessThan(escalated.irritation);
    expect(escalated.irritation - update.state.irritation).toBeLessThanOrEqual(18);
    expect(update.state.tone).not.toBe("open");
  });

  it("не переносит пустую реплику в новое состояние", () => {
    const initial = createInitialOpponentEmotion("collaborative");
    expect(updateOpponentEmotion(initial, {
      transcript: "   ",
      interruptedOpponent: true,
      style: "collaborative",
    })).toEqual({ state: initial, triggers: [] });
  });

  it("не принимает отрицание и уклончивое «как-нибудь» за конструктивные сигналы", () => {
    const initial = createInitialOpponentEmotion("collaborative");
    const update = updateOpponentEmotion(initial, {
      transcript: "Я не понимаю вас и не согласен. Давайте как-нибудь потом решим.",
      interruptedOpponent: false,
      style: "collaborative",
    });

    expect(update.triggers).toContain("evasion");
    expect(update.triggers).not.toContain("respect");
    expect(update.triggers).not.toContain("concession");
    expect(update.triggers).not.toContain("question");
    expect(update.triggers).not.toContain("concrete_offer");
  });

  it("задаёт голосовую режиссуру без разрешения произносить служебное состояние", () => {
    const instructions = buildOpponentEmotionInstructions({
      trust: 12,
      tension: 88,
      irritation: 80,
      dominance: 90,
      engagement: 28,
      tone: "angry",
    }, ["pressure", "interruption"]);

    expect(instructions).toContain("Говори жёстко, отрывисто");
    expect(instructions).toContain("перебил оппонента");
    expect(instructions).toContain("сделай смену интонации различимой на слух");
    expect(instructions).toContain("Не называй эмоцию, состояние, триггеры или числовые значения вслух");
    expect(instructions).toContain("Сохраняй роль, цели, ограничения");
  });
});
