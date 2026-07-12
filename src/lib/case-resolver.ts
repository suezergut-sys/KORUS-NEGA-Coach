import "server-only";

import { DEFAULT_CASE, DEFAULT_CASE_ID } from "@/lib/default-case";
import { mapCaseRow, type CanonicalCase } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolvePublishedCase(caseId?: string, caseCode?: string): Promise<CanonicalCase | null> {
  if (caseId === DEFAULT_CASE_ID || (!caseId && (!caseCode || caseCode === DEFAULT_CASE.slug))) return DEFAULT_CASE;
  const db = getSupabaseAdmin();
  let query = db.from("negotiation_cases").select("*").eq("status", "published");
  if (caseId) {
    if (!UUID.test(caseId)) return null;
    query = query.eq("id", caseId);
  } else if (caseCode) {
    query = query.eq("slug", caseCode.slice(0, 120));
  } else {
    return null;
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Кейс: ${error.message}`);
  return data ? mapCaseRow(data) : null;
}

export function selectCaseRoles(item: CanonicalCase, participantIndex: number, opponentIndex: number) {
  const roles = [item.userRole, item.opponentRole, ...item.additionalRoles];
  const safeParticipant = Number.isInteger(participantIndex) && roles[participantIndex] ? participantIndex : 0;
  const fallbackOpponent = roles.findIndex((_, index) => index !== safeParticipant);
  const safeOpponent = Number.isInteger(opponentIndex) && opponentIndex !== safeParticipant && roles[opponentIndex]
    ? opponentIndex
    : fallbackOpponent;
  return { roles, participantRoleIndex: safeParticipant, opponentRoleIndex: safeOpponent, participantRole: roles[safeParticipant], opponentRole: roles[safeOpponent] };
}
