import "server-only";

import { randomUUID } from "node:crypto";
import { extractUploadedFile, validateFiles } from "@/lib/case-files";
import { isCanonicalPersonName, mapCaseRow, normalizeCaseRole, type CanonicalCase, type CaseWorkspaceView, type GeneratedCaseVariant } from "@/lib/case-types";
import { assertNegotiationPairs } from "@/lib/case-negotiation-pairs";
import type { CaseVisibility } from "@/lib/case-visibility";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function assertCanonicalRoleNames(...roles: Array<{ name?: string }>) {
  if (roles.some((role) => !isCanonicalPersonName(role.name || ""))) {
    throw new Error("Канонический кейс должен содержать имя и фамилию каждой стороны; должность указывается отдельно.");
  }
}

function normalizeGeneratedVariant(variant: GeneratedCaseVariant) {
  const roleCount = 2 + variant.additionalRoles.length;
  return {
    ...variant,
    userRole: normalizeCaseRole(variant.userRole),
    opponentRole: normalizeCaseRole(variant.opponentRole),
    additionalRoles: variant.additionalRoles.map(normalizeCaseRole),
    negotiationPairs: assertNegotiationPairs(variant.negotiationPairs, roleCount),
  };
}

function variantInsertRow(workspaceId: string, variant: GeneratedCaseVariant) {
  const normalized = normalizeGeneratedVariant(variant);
  return {
    workspace_id: workspaceId,
    title: normalized.title,
    summary: normalized.summary,
    situation: normalized.situation,
    conflict: normalized.conflict,
    user_role: normalized.userRole,
    opponent_role: normalized.opponentRole,
    additional_roles: normalized.additionalRoles,
    negotiation_pairs: normalized.negotiationPairs,
    stakes: normalized.stakes,
    start_situation: normalized.startSituation,
    difficulty_reason: normalized.difficultyReason,
    evaluation_focus: normalized.evaluationFocus,
    methodology_basis: normalized.methodologyBasis,
  };
}

export async function createOrUpdateWorkspace(input: { workspaceId?: string; title: string; notes: string; ownerUserId: string }) {
  const supabase = getSupabaseAdmin();
  if (input.workspaceId) {
    const { data, error } = await supabase
      .from("case_workspaces")
      .update({ title: input.title || "Новый кейс", notes: input.notes, updated_at: new Date().toISOString() })
      .eq("id", input.workspaceId)
      .eq("owner_user_id", input.ownerUserId)
      .select("id,title,notes,status")
      .single();
    if (error) throw new Error(`Черновик кейса: ${error.message}`);
    return data;
  }
  const { data, error } = await supabase
    .from("case_workspaces")
    .insert({ title: input.title || "Новый кейс", notes: input.notes, owner_user_id: input.ownerUserId })
    .select("id,title,notes,status")
    .single();
  if (error) throw new Error(`Создание черновика: ${error.message}`);
  return data;
}

export async function addWorkspaceFiles(workspaceId: string, files: File[], ownerUserId: string) {
  if (!files.length) return [];
  const supabase = getSupabaseAdmin();
  const { data: workspace, error: workspaceError } = await supabase
    .from("case_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (workspaceError || !workspace) throw new Error("Черновик кейса не найден или принадлежит другому пользователю.");
  const { data: existing, error: existingError } = await supabase
    .from("case_materials")
    .select("size_bytes")
    .eq("workspace_id", workspaceId);
  if (existingError) throw new Error(`Материалы кейса: ${existingError.message}`);
  validateFiles(files, {
    count: existing?.length || 0,
    totalBytes: (existing || []).reduce((sum, item) => sum + Number(item.size_bytes || 0), 0),
  });
  const rows = [];
  const uploadedPaths: string[] = [];
  try {
    for (const file of files) {
      const extracted = await extractUploadedFile(file);
      const storagePath = `${workspaceId}/${randomUUID()}-${extracted.safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("case-materials")
        .upload(storagePath, extracted.bytes, { contentType: extracted.mimeType, upsert: false });
      if (uploadError) throw new Error(`Сохранение файла «${extracted.displayName}»: ${uploadError.message}`);
      uploadedPaths.push(storagePath);
      rows.push({
        workspace_id: workspaceId,
        file_name: extracted.displayName,
        mime_type: extracted.mimeType,
        size_bytes: file.size,
        storage_path: storagePath,
        extracted_text: extracted.text,
      });
    }
    const { data, error } = await supabase
      .from("case_materials")
      .insert(rows)
      .select("id,file_name,mime_type,size_bytes,extracted_text");
    if (error) throw new Error(`Материалы кейса: ${error.message}`);
    return data || [];
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from("case-materials").remove(uploadedPaths);
    throw error;
  }
}

export async function getWorkspaceMaterials(workspaceId: string, ownerUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data: workspace, error: workspaceError } = await supabase
    .from("case_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (workspaceError || !workspace) throw new Error("Черновик кейса не найден или принадлежит другому пользователю.");
  const { data, error } = await getSupabaseAdmin()
    .from("case_materials")
    .select("id,file_name,mime_type,size_bytes,extracted_text")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Материалы кейса: ${error.message}`);
  return data || [];
}

export async function discardWorkspace(workspaceId: string, ownerUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data: workspace } = await supabase
    .from("case_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!workspace) return;
  const { data: materials } = await supabase.from("case_materials").select("storage_path").eq("workspace_id", workspaceId);
  const paths = (materials || []).map((item) => item.storage_path).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from("case-materials").remove(paths);
  await supabase.from("case_workspaces").delete().eq("id", workspaceId);
}

export async function saveGeneratedVariants(workspaceId: string, variants: GeneratedCaseVariant[], ownerUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data: workspace, error: workspaceLookupError } = await supabase
    .from("case_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (workspaceLookupError || !workspace) throw new Error("Черновик кейса не найден или принадлежит другому пользователю.");
  const { data, error } = await supabase
    .from("case_variants")
    .insert(variants.map((variant) => variantInsertRow(workspaceId, variant)))
    .select("*");
  if (error) throw new Error(`Варианты кейса: ${error.message}`);
  const { error: workspaceError } = await supabase.from("case_workspaces").update({ status: "analyzed", updated_at: new Date().toISOString() }).eq("id", workspaceId);
  if (workspaceError) {
    if (data?.length) await supabase.from("case_variants").delete().in("id", data.map((item) => item.id));
    throw new Error(`Статус черновика: ${workspaceError.message}`);
  }
  return data || [];
}

export async function getVariantForRevision(variantId: string, ownerUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data: variant, error: variantError } = await supabase.from("case_variants").select("*").eq("id", variantId).maybeSingle();
  if (variantError || !variant) throw new Error("Вариант кейса не найден.");
  const { data: workspace, error: workspaceError } = await supabase
    .from("case_workspaces")
    .select("id")
    .eq("id", variant.workspace_id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (workspaceError || !workspace) throw new Error("Вариант кейса не найден или принадлежит другому пользователю.");
  if (variant.approved_at) throw new Error("Утверждённый кейс нельзя заменить через конструктор.");
  return {
    workspaceId: workspace.id,
    variant: {
      title: variant.title,
      summary: variant.summary,
      situation: variant.situation,
      conflict: variant.conflict,
      userRole: variant.user_role,
      opponentRole: variant.opponent_role,
      additionalRoles: variant.additional_roles || [],
      negotiationPairs: variant.negotiation_pairs || [],
      stakes: variant.stakes,
      startSituation: variant.start_situation,
      difficultyReason: variant.difficulty_reason,
      evaluationFocus: variant.evaluation_focus,
      methodologyBasis: variant.methodology_basis,
    } as GeneratedCaseVariant,
  };
}

export async function replaceWorkspaceVariants(workspaceId: string, revised: GeneratedCaseVariant, ownerUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data: workspace, error: workspaceError } = await supabase
    .from("case_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (workspaceError || !workspace) throw new Error("Черновик кейса не найден или принадлежит другому пользователю.");
  const { data: inserted, error: insertError } = await supabase
    .from("case_variants")
    .insert(variantInsertRow(workspaceId, revised))
    .select("id")
    .single();
  if (insertError || !inserted) throw new Error(`Исправленный вариант: ${insertError?.message || "не сохранён"}`);

  const { error: deleteError } = await supabase
    .from("case_variants")
    .delete()
    .eq("workspace_id", workspaceId)
    .is("approved_at", null)
    .neq("id", inserted.id);
  if (deleteError) {
    await supabase.from("case_variants").delete().eq("id", inserted.id);
    throw new Error(`Замена прежних вариантов: ${deleteError.message}`);
  }
  const { error: statusError } = await supabase
    .from("case_workspaces")
    .update({ status: "analyzed", updated_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .eq("owner_user_id", ownerUserId);
  if (statusError) throw new Error(`Статус черновика: ${statusError.message}`);
  return inserted.id;
}

export async function approveVariant(
  variantId: string,
  origin: CanonicalCase["origin"],
  createdBy: string,
  ownerUserId: string,
  visibility: CaseVisibility,
) {
  const supabase = getSupabaseAdmin();
  const { data: variant, error: variantError } = await supabase
    .from("case_variants")
    .select("*")
    .eq("id", variantId)
    .single();
  if (variantError) throw new Error(`Вариант кейса: ${variantError.message}`);
  assertCanonicalRoleNames(variant.user_role, variant.opponent_role, ...(variant.additional_roles || []));
  const { data: approvedId, error: approvalError } = await supabase.rpc("approve_case_variant", {
    p_variant_id: variantId,
    p_origin: origin,
    p_owner_user_id: ownerUserId,
    p_visibility: visibility,
  });
  if (approvalError || !approvedId) throw new Error(`Публикация кейса: ${approvalError?.message || "не получен идентификатор"}`);
  const author = createdBy.trim().slice(0, 160);
  const { error: authorError } = await supabase.from("negotiation_cases").update({ created_by: author }).eq("id", approvedId);
  if (authorError) throw new Error(`Автор кейса: ${authorError.message}`);
  const { data: approved, error: lookupError } = await supabase.from("negotiation_cases").select("*").eq("id", approvedId).single();
  if (lookupError) throw new Error(`Опубликованный кейс: ${lookupError.message}`);
  return mapCaseRow(approved);
}

export async function getWorkspaceView(workspaceId: string, ownerUserId: string): Promise<CaseWorkspaceView> {
  const supabase = getSupabaseAdmin();
  const [{ data: workspace, error: workspaceError }, { data: materials }, { data: variants }] = await Promise.all([
    supabase.from("case_workspaces").select("id,title,notes,status").eq("id", workspaceId).eq("owner_user_id", ownerUserId).single(),
    supabase.from("case_materials").select("id,file_name,mime_type,size_bytes").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    supabase.from("case_variants").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(9),
  ]);
  if (workspaceError) throw new Error(`Черновик кейса: ${workspaceError.message}`);
  return {
    id: workspace.id,
    title: workspace.title,
    notes: workspace.notes,
    status: workspace.status,
    materials: (materials || []).map((item) => ({ id: item.id, fileName: item.file_name, mimeType: item.mime_type, sizeBytes: item.size_bytes })),
    variants: (variants || []).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      situation: item.situation,
      conflict: item.conflict,
      userRole: { ...item.user_role, hiddenMotives: [] },
      opponentRole: { ...item.opponent_role, hiddenMotives: [] },
      additionalRoles: (item.additional_roles || []).map((role: CanonicalCase["userRole"]) => ({ ...role, hiddenMotives: [] })),
      negotiationPairs: item.negotiation_pairs || [],
      stakes: item.stakes,
      startSituation: item.start_situation,
      difficultyReason: item.difficulty_reason,
      evaluationFocus: item.evaluation_focus,
      methodologyBasis: item.methodology_basis,
      approvedAt: item.approved_at,
    })),
  };
}
