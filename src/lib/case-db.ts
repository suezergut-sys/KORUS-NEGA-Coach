import "server-only";

import { randomUUID } from "node:crypto";
import { extractUploadedFile, validateFiles } from "@/lib/case-files";
import { isCanonicalPersonName, mapCaseRow, normalizeCaseRole, type CanonicalCase, type CaseWorkspaceView, type GeneratedCaseVariant } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function assertCanonicalRoleNames(...roles: Array<{ name?: string }>) {
  if (roles.some((role) => !isCanonicalPersonName(role.name || ""))) {
    throw new Error("Канонический кейс должен содержать имя и фамилию каждой стороны; должность указывается отдельно.");
  }
}

export async function createOrUpdateWorkspace(input: { workspaceId?: string; title: string; notes: string }) {
  const supabase = getSupabaseAdmin();
  if (input.workspaceId) {
    const { data, error } = await supabase
      .from("case_workspaces")
      .update({ title: input.title || "Новый кейс", notes: input.notes, updated_at: new Date().toISOString() })
      .eq("id", input.workspaceId)
      .select("id,title,notes,status")
      .single();
    if (error) throw new Error(`Черновик кейса: ${error.message}`);
    return data;
  }
  const { data, error } = await supabase
    .from("case_workspaces")
    .insert({ title: input.title || "Новый кейс", notes: input.notes })
    .select("id,title,notes,status")
    .single();
  if (error) throw new Error(`Создание черновика: ${error.message}`);
  return data;
}

export async function addWorkspaceFiles(workspaceId: string, files: File[]) {
  if (!files.length) return [];
  const supabase = getSupabaseAdmin();
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

export async function getWorkspaceMaterials(workspaceId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("case_materials")
    .select("id,file_name,mime_type,size_bytes,extracted_text")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Материалы кейса: ${error.message}`);
  return data || [];
}

export async function discardWorkspace(workspaceId: string) {
  const supabase = getSupabaseAdmin();
  const { data: materials } = await supabase.from("case_materials").select("storage_path").eq("workspace_id", workspaceId);
  const paths = (materials || []).map((item) => item.storage_path).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from("case-materials").remove(paths);
  await supabase.from("case_workspaces").delete().eq("id", workspaceId);
}

export async function saveGeneratedVariants(workspaceId: string, variants: GeneratedCaseVariant[]) {
  const supabase = getSupabaseAdmin();
  const normalized = variants.map((variant) => ({
    ...variant,
    userRole: normalizeCaseRole(variant.userRole),
    opponentRole: normalizeCaseRole(variant.opponentRole),
    additionalRoles: variant.additionalRoles.map(normalizeCaseRole),
  }));
  const { data, error } = await supabase
    .from("case_variants")
    .insert(normalized.map((variant) => ({
      workspace_id: workspaceId,
      title: variant.title,
      summary: variant.summary,
      situation: variant.situation,
      conflict: variant.conflict,
      user_role: variant.userRole,
      opponent_role: variant.opponentRole,
      additional_roles: variant.additionalRoles,
      stakes: variant.stakes,
      start_situation: variant.startSituation,
      difficulty_reason: variant.difficultyReason,
      evaluation_focus: variant.evaluationFocus,
      methodology_basis: variant.methodologyBasis,
    })))
    .select("*");
  if (error) throw new Error(`Варианты кейса: ${error.message}`);
  const { error: workspaceError } = await supabase.from("case_workspaces").update({ status: "analyzed", updated_at: new Date().toISOString() }).eq("id", workspaceId);
  if (workspaceError) {
    if (data?.length) await supabase.from("case_variants").delete().in("id", data.map((item) => item.id));
    throw new Error(`Статус черновика: ${workspaceError.message}`);
  }
  return data || [];
}

export async function approveVariant(variantId: string, origin: CanonicalCase["origin"] = "builder") {
  const supabase = getSupabaseAdmin();
  const { data: variant, error: variantError } = await supabase
    .from("case_variants")
    .select("*")
    .eq("id", variantId)
    .single();
  if (variantError) throw new Error(`Вариант кейса: ${variantError.message}`);
  assertCanonicalRoleNames(variant.user_role, variant.opponent_role, ...(variant.additional_roles || []));
  const { data: approvedId, error: approvalError } = await supabase.rpc("approve_case_variant", { p_variant_id: variantId, p_origin: origin });
  if (approvalError || !approvedId) throw new Error(`Публикация кейса: ${approvalError?.message || "не получен идентификатор"}`);
  const { data: approved, error: lookupError } = await supabase.from("negotiation_cases").select("*").eq("id", approvedId).single();
  if (lookupError) throw new Error(`Опубликованный кейс: ${lookupError.message}`);
  return mapCaseRow(approved);
}

export async function getWorkspaceView(workspaceId: string): Promise<CaseWorkspaceView> {
  const supabase = getSupabaseAdmin();
  const [{ data: workspace, error: workspaceError }, { data: materials }, { data: variants }] = await Promise.all([
    supabase.from("case_workspaces").select("id,title,notes,status").eq("id", workspaceId).single(),
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
      stakes: item.stakes,
      startSituation: item.start_situation,
      difficultyReason: item.difficulty_reason,
      evaluationFocus: item.evaluation_focus,
      methodologyBasis: item.methodology_basis,
      approvedAt: item.approved_at,
    })),
  };
}
