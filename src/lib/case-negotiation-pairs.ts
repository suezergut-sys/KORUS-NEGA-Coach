import type { CanonicalCase, NegotiationPair } from "@/lib/case-types";

export function allNegotiationPairs(roleCount: number): NegotiationPair[] {
  const pairs: NegotiationPair[] = [];
  for (let roleAIndex = 0; roleAIndex < roleCount; roleAIndex += 1) {
    for (let roleBIndex = roleAIndex + 1; roleBIndex < roleCount; roleBIndex += 1) {
      pairs.push({ roleAIndex, roleBIndex, reason: "У ролей есть прямой предмет переговоров и несовместимые интересы." });
    }
  }
  return pairs;
}

export function normalizeNegotiationPairs(value: unknown, roleCount: number, fallbackToAll = true): NegotiationPair[] {
  const unique = new Map<string, NegotiationPair>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const first = Number(item.roleAIndex);
      const second = Number(item.roleBIndex);
      if (!Number.isInteger(first) || !Number.isInteger(second) || first === second) continue;
      const roleAIndex = Math.min(first, second);
      const roleBIndex = Math.max(first, second);
      if (roleAIndex < 0 || roleBIndex >= roleCount) continue;
      const reason = typeof item.reason === "string" ? item.reason.trim().slice(0, 1000) : "";
      unique.set(`${roleAIndex}:${roleBIndex}`, { roleAIndex, roleBIndex, reason });
    }
  }
  const pairs = [...unique.values()];
  return pairs.length || !fallbackToAll ? pairs : allNegotiationPairs(roleCount);
}

export function assertNegotiationPairs(value: unknown, roleCount: number): NegotiationPair[] {
  const pairs = normalizeNegotiationPairs(value, roleCount, false);
  if (!pairs.length || pairs.some((pair) => !pair.reason)) {
    throw new Error("Для кейса нужно указать допустимые пары оппонентов и предмет переговоров каждой пары.");
  }
  const coveredRoles = new Set(pairs.flatMap((pair) => [pair.roleAIndex, pair.roleBIndex]));
  if (coveredRoles.size !== roleCount) {
    throw new Error("Каждая роль кейса должна иметь хотя бы одного допустимого оппонента.");
  }
  return pairs;
}

export function opponentIndicesForRole(item: CanonicalCase, participantIndex: number) {
  const roleCount = 2 + item.additionalRoles.length;
  const safeParticipant = Number.isInteger(participantIndex) && participantIndex >= 0 && participantIndex < roleCount ? participantIndex : 0;
  const pairs = normalizeNegotiationPairs(item.negotiationPairs, roleCount);
  return pairs.flatMap((pair) => {
    if (pair.roleAIndex === safeParticipant) return [pair.roleBIndex];
    if (pair.roleBIndex === safeParticipant) return [pair.roleAIndex];
    return [];
  });
}

export function cycleOpponentIndex(candidates: number[], current: number, direction: -1 | 1) {
  if (!candidates.length) return current;
  const currentPosition = candidates.indexOf(current);
  const start = currentPosition >= 0 ? currentPosition : 0;
  return candidates[(start + direction + candidates.length) % candidates.length];
}
