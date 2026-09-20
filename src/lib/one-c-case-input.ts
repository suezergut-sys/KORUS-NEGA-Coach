export const ONE_C_REASON_OPTIONS = ["плохая обратная связь", "токсичная «звезда»", "плохая дисциплина"] as const;
export const ONE_C_PROFILE_OPTIONS = ["спорит", "плачет", "агрессирует", "молчит", "юридически подкован", "давит на жалость"] as const;
export const ONE_C_OBJECTION_OPTIONS = [
  "не давали обратную связь",
  "разговор в день рождения",
  "есть кредиты",
  "риск потери отсрочки",
  "сотрудник включает запись",
  "просит директора",
  "требует компенсацию",
] as const;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function selections(value: unknown, allowed: readonly string[], other: unknown) {
  const values = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && allowed.includes(item)).slice(0, allowed.length)
    : [];
  const custom = text(other, 1000);
  return [...new Set([...values, ...(custom ? [custom] : [])])];
}

export function parseOneCCaseBrief(value: unknown) {
  const body = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const situation = text(body.situation, 12000);
  const agreementFrame = text(body.agreementFrame, 6000);
  if (situation.length < 40) throw new Error("Опишите ситуацию подробнее — минимум 40 символов.");
  if (agreementFrame.length < 10) throw new Error("Укажите, что можно предлагать сотруднику и что нельзя обещать.");
  return {
    situation,
    reasons: selections(body.reasons, ONE_C_REASON_OPTIONS, body.otherReason),
    profiles: selections(body.profiles, ONE_C_PROFILE_OPTIONS, body.otherProfile),
    objections: selections(body.objections, ONE_C_OBJECTION_OPTIONS, body.otherObjection),
    agreementFrame,
  };
}

export type OneCCaseBrief = ReturnType<typeof parseOneCCaseBrief>;
