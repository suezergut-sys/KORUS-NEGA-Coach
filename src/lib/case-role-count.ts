export type CaseRoleCount = 2 | 3 | 4;

export function parseCaseRoleCount(value: unknown): CaseRoleCount | undefined {
  const parsed = Number(value);
  return parsed === 2 || parsed === 3 || parsed === 4 ? parsed : undefined;
}

function countFromToken(token: string): CaseRoleCount | undefined {
  const normalized = token.toLocaleLowerCase("ru-RU");
  if (normalized === "2" || normalized.startsWith("дв")) return 2;
  if (normalized === "3" || normalized.startsWith("тр")) return 3;
  if (normalized === "4" || normalized.startsWith("четыр") || normalized.startsWith("четверт")) return 4;
  return undefined;
}

export function detectRequestedCaseRoleCount(text: string): CaseRoleCount | undefined {
  const matches = text.matchAll(/(?<![\p{L}\p{N}])(2|3|4|дв\p{L}*|тр\p{L}*|четыр\p{L}*|четверт\p{L}*)\s+(?:отдельн\p{L}*\s+)?(?:рол\p{L}*|участник\p{L}*|сторон\p{L}*)(?![\p{L}\p{N}])/giu);
  let detected: CaseRoleCount | undefined;
  for (const match of matches) detected = countFromToken(match[1]) || detected;
  return detected;
}
