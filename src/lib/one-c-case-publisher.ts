import "server-only";

import { randomUUID } from "node:crypto";
import { parseAdminCaseInput } from "@/lib/admin-case-input";
import { mapCaseRow, toPublicCase, type CanonicalCase } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function publishPrivateOneCCase(input: unknown, ownerUserId: string, departmentId: string, createdBy: string): Promise<CanonicalCase> {
  const parsed = parseAdminCaseInput({
    ...(input && typeof input === "object" ? input : {}),
    status: "published",
    origin: "builder",
    createdBy,
  });
  if (parsed.additionalRoles.length) throw new Error("Кейс 1С должен содержать только роли руководителя и сотрудника.");

  const db = getSupabaseAdmin();
  const { data: source, error: sourceError } = await db.from("method_sources").select("id").eq("code", "SRC-004").maybeSingle();
  if (sourceError || !source) throw new Error("Методология 1С не найдена.");
  const requestedAtomIds = parsed.methodologyBasis.map((item) => item.atomId).filter(Boolean);
  const { data: allowedAtoms, error: atomError } = requestedAtomIds.length
    ? await db.from("method_atoms").select("id").eq("source_id", source.id).in("id", requestedAtomIds)
    : { data: [], error: null };
  if (atomError) throw new Error(`Методология 1С: ${atomError.message}`);
  const allowedAtomIds = new Set((allowedAtoms || []).map((item) => String(item.id)));
  const methodologyBasis = parsed.methodologyBasis.filter((item) => allowedAtomIds.has(item.atomId));

  const { data, error } = await db.from("negotiation_cases").insert({
    slug: `1c-private-${randomUUID()}`,
    title: parsed.title,
    summary: parsed.summary,
    situation: parsed.situation,
    conflict: parsed.conflict,
    address_form: parsed.addressForm,
    user_role: parsed.userRole,
    opponent_role: parsed.opponentRole,
    additional_roles: [],
    negotiation_pairs: parsed.negotiationPairs,
    stakes: parsed.stakes,
    start_situation: parsed.startSituation,
    difficulty_reason: parsed.difficultyReason,
    evaluation_focus: parsed.evaluationFocus,
    methodology_basis: methodologyBasis,
    scenario_conditions: parsed.scenarioConditions,
    decision_terms: parsed.decisionTerms,
    authority_limits: parsed.authorityLimits,
    risk_zones: parsed.riskZones,
    success_outcome: parsed.successOutcome,
    expected_next_steps: parsed.expectedNextSteps,
    methodology_notes: parsed.methodologyNotes,
    required_methodology_id: "dismissal_1c",
    required_participant_role_index: 0,
    required_first_speaker: "participant",
    department_id: departmentId,
    owner_user_id: ownerUserId,
    visibility: "private",
    origin: "builder",
    status: "published",
    created_by: createdBy.trim().slice(0, 160),
  }).select("*").single();
  if (error || !data) throw new Error(`Публикация кейса 1С: ${error?.message || "кейс не сохранён"}`);
  return toPublicCase(mapCaseRow(data));
}
