import type { CanonicalCase } from "@/lib/case-types";

export function selectCaseRoles(item: CanonicalCase, participantIndex: number, opponentIndex: number) {
  const roles = [item.userRole, item.opponentRole, ...item.additionalRoles];
  const safeParticipant = Number.isInteger(participantIndex) && roles[participantIndex] ? participantIndex : 0;
  const fallbackOpponent = roles.findIndex((_, index) => index !== safeParticipant);
  const safeOpponent = Number.isInteger(opponentIndex) && opponentIndex !== safeParticipant && roles[opponentIndex]
    ? opponentIndex
    : fallbackOpponent;
  return { roles, participantRoleIndex: safeParticipant, opponentRoleIndex: safeOpponent, participantRole: roles[safeParticipant], opponentRole: roles[safeOpponent] };
}
