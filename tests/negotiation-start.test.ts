import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildNegotiationStartContract,
  firstSpeakerForCase,
  matchesTrainingSessionStart,
  normalizeFirstSpeaker,
  realtimeReadyMessage,
  type FirstSpeaker,
  type NegotiationStyle,
} from "@/lib/negotiation-start";
import type { AddressForm } from "@/lib/case-types";

const participantRole = {
  name: "Анна Соколова",
  position: "Руководитель проекта",
  publicGoal: "Согласовать новый план запуска",
};
const opponentRole = {
  name: "Борис Воронцов",
  position: "Директор по качеству",
  publicGoal: "Не допустить рискованный запуск",
};

describe("стартовый контракт переговоров", () => {
  it.each([
    ["participant", "collaborative", "informal"],
    ["participant", "hard", "formal"],
    ["opponent", "collaborative", "formal"],
    ["opponent", "hard", "informal"],
  ] satisfies Array<[FirstSpeaker, NegotiationStyle, AddressForm]>) (
    "закрепляет стороны и настройки для инициатора %s, стиля %s и обращения %s",
    (firstSpeaker, negotiationStyle, addressForm) => {
      const contract = buildNegotiationStartContract({
        firstSpeaker,
        negotiationStyle,
        addressForm,
        participantRole,
        opponentRole,
      });

      expect(contract).toContain("AI-ОППОНЕНТ: Борис Воронцов, Директор по качеству.");
      expect(contract).toContain("УЧАСТНИК-ЧЕЛОВЕК: Анна Соколова, Руководитель проекта.");
      expect(contract).toContain("ЦЕЛЬ AI-ОППОНЕНТА, ПРИНАДЛЕЖАЩАЯ ТОЛЬКО ЕМУ: Не допустить рискованный запуск");
      expect(contract).toContain("ЦЕЛЬ УЧАСТНИКА, ПРИНАДЛЕЖАЩАЯ ТОЛЬКО ЕМУ: Согласовать новый план запуска");
      expect(contract).toContain(negotiationStyle === "hard" ? "СТИЛЬ AI-ОППОНЕНТА: ЖЁСТКИЙ" : "СТИЛЬ AI-ОППОНЕНТА: СОТРУДНИЧЕСТВО");
      expect(contract).toContain(addressForm === "informal" ? "ФОРМА ОБРАЩЕНИЯ: НА «ТЫ»" : "ФОРМА ОБРАЩЕНИЯ: НА «ВЫ»");
      expect(contract).toContain(firstSpeaker === "participant" ? "ПЕРВЫМ ГОВОРИТ УЧАСТНИК-ЧЕЛОВЕК" : "ПЕРВЫМ ГОВОРИТ AI-ОППОНЕНТ");
    },
  );

  it("безопасно нормализует инициатора и выдаёт точное сообщение человеку", () => {
    expect(normalizeFirstSpeaker("participant")).toBe("participant");
    expect(normalizeFirstSpeaker("opponent")).toBe("opponent");
    expect(normalizeFirstSpeaker("подмена")).toBe("opponent");
    expect(realtimeReadyMessage("participant", "Борис Воронцов")).toBe("Можете произносить первую реплику.");
    expect(realtimeReadyMessage("opponent", "Борис Воронцов")).toBe("Связь установлена. Борис Воронцов начинает переговоры.");
  });

  it("закрепляет первую реплику только за кейсом с обязательным инициатором", () => {
    expect(firstSpeakerForCase({ requiredFirstSpeaker: "participant" }, "opponent")).toBe("participant");
    expect(firstSpeakerForCase({ requiredFirstSpeaker: null }, "opponent")).toBe("opponent");
    expect(firstSpeakerForCase({}, "participant")).toBe("participant");
  });

  it("не открывает Realtime при рассинхронизации сохранённых ролей и выбранного старта", () => {
    const saved = {
      case_id: "case-1",
      case_code: "release-risk",
      participant_role_name: "Анна Соколова",
      opponent_name: "Борис Воронцов",
    };
    const expected = {
      caseId: "case-1",
      caseCode: "release-risk",
      participantRoleName: "Анна Соколова",
      opponentRoleName: "Борис Воронцов",
    };

    expect(matchesTrainingSessionStart({ saved, expected })).toBe(true);
    expect(matchesTrainingSessionStart({ saved, expected: { ...expected, opponentRoleName: "Анна Соколова" } })).toBe(false);
    expect(matchesTrainingSessionStart({ saved, expected: { ...expected, participantRoleName: "Борис Воронцов" } })).toBe(false);
    expect(matchesTrainingSessionStart({ saved, expected: { ...expected, caseCode: "другой-кейс" } })).toBe(false);
  });

  it("располагает выбор инициатора между ролью и стилем и не запускает AI при старте человека", () => {
    const arena = readFileSync("src/components/VoiceArena.tsx", "utf8");
    const roleSetting = arena.indexOf("<RoleSelect");
    const firstSpeakerSetting = arena.indexOf("ВЫБЕРИ ПЕРВУЮ РЕПЛИКУ");
    const styleSetting = arena.indexOf("ВЫБЕРИ СТИЛЬ ОППОНЕНТА");

    expect(roleSetting).toBeGreaterThan(-1);
    expect(firstSpeakerSetting).toBeGreaterThan(roleSetting);
    expect(styleSetting).toBeGreaterThan(firstSpeakerSetting);
    expect(arena).toContain('if (firstSpeaker === "opponent")');
    expect(arena).toContain("track.enabled = false");
    expect(arena).toContain("syncMicrophoneTrack();");
    const route = readFileSync("src/app/api/realtime/session/route.ts", "utf8");
    const textRoute = readFileSync("src/app/api/text-negotiation/route.ts", "utf8");
    const platformPanel = readFileSync("src/components/PlatformTestingPanel.tsx", "utf8");
    expect(route).toContain("firstSpeakerForCase(negotiationCase");
    expect(textRoute).toContain("firstSpeakerForCase(negotiationCase");
    expect(platformPanel).toContain('selectedCase.requiredFirstSpeaker === "participant"');
    expect(platformPanel).toContain("generateHumanTurnRef.current()");
    expect(route.indexOf("matchesTrainingSessionStart")).toBeLessThan(route.indexOf('rpc("claim_training_realtime"'));
  });
});
