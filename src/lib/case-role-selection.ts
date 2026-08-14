import type { CanonicalCase } from "@/lib/case-types";
import { opponentIndicesForRole } from "@/lib/case-negotiation-pairs";

export function selectCaseRoles(item: CanonicalCase, participantIndex: number, opponentIndex: number) {
  const roles = [item.userRole, item.opponentRole, ...item.additionalRoles];
  const safeParticipant = Number.isInteger(participantIndex) && roles[participantIndex] ? participantIndex : 0;
  const candidates = opponentIndicesForRole(item, safeParticipant);
  const fallbackOpponent = candidates[0];
  const safeOpponent = Number.isInteger(opponentIndex) && candidates.includes(opponentIndex)
    ? opponentIndex
    : fallbackOpponent;
  const negotiationPair = item.negotiationPairs.find((pair) =>
    (pair.roleAIndex === safeParticipant && pair.roleBIndex === safeOpponent)
    || (pair.roleBIndex === safeParticipant && pair.roleAIndex === safeOpponent));
  return { roles, opponentIndices: candidates, negotiationReason: negotiationPair?.reason || "", participantRoleIndex: safeParticipant, opponentRoleIndex: safeOpponent, participantRole: roles[safeParticipant], opponentRole: roles[safeOpponent] };
}
