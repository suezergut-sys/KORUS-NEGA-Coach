import "server-only";

import { randomUUID } from "node:crypto";
import { extractUploadedFile, validateFiles } from "@/lib/case-files";
import { mapCaseRow, type CanonicalCase, type CaseWorkspaceView, type GeneratedCaseVariant } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const FULL_PERSON_NAME = /^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?$/;

function assertCanonicalRoleNames(...roles: Array<{ name?: string }>) {
  if (roles.some((role) => !FULL_PERSON_NAME.test(role.name || ""))) {
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
  validateFiles(files);
  if (!files.length) return [];
  const supabase = getSupabaseAdmin();
  const rows = [];
  for (const file of files) {
    const extracted = await extractUploadedFile(file);
    const storagePath = `${workspaceId}/${randomUUID()}-${extracted.safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("case-materials")
      .upload(storagePath, extracted.bytes, { contentType: extracted.mimeType, upsert: false });
    if (uploadError) throw new Error(`Сохранение файла «${file.name}»: ${uploadError.message}`);
    rows.push({
      workspace_id: workspaceId,
      file_name: extracted.safeName,
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

export async function saveGeneratedVariants(workspaceId: string, variants: GeneratedCaseVariant[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("case_variants")
    .insert(variants.map((variant) => ({
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
  await supabase.from("case_workspaces").update({ status: "analyzed", updated_at: new Date().toISOString() }).eq("id", workspaceId);
  return data || [];
}

export async function approveVariant(variantId: string, origin: CanonicalCase["origin"] = "builder") {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("negotiation_cases")
    .select("*")
    .eq("source_variant_id", variantId)
    .maybeSingle();
  if (existing) return mapCaseRow(existing);

  const { data: variant, error: variantError } = await supabase
    .from("case_variants")
    .select("*")
    .eq("id", variantId)
    .single();
  if (variantError) throw new Error(`Вариант кейса: ${variantError.message}`);
  assertCanonicalRoleNames(variant.user_role, variant.opponent_role, ...(variant.additional_roles || []));
  const slug = `case-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const { data: approved, error: insertError } = await supabase
    .from("negotiation_cases")
    .insert({
      workspace_id: variant.workspace_id,
      source_variant_id: variant.id,
      slug,
      title: variant.title,
      summary: variant.summary,
      situation: variant.situation,
      conflict: variant.conflict,
      user_role: variant.user_role,
      opponent_role: variant.opponent_role,
      additional_roles: variant.additional_roles,
      stakes: variant.stakes,
      start_situation: variant.start_situation,
      difficulty_reason: variant.difficulty_reason,
      evaluation_focus: variant.evaluation_focus,
      methodology_basis: variant.methodology_basis,
      origin,
      status: "published",
    })
    .select("*")
    .single();
  if (insertError) throw new Error(`Публикация кейса: ${insertError.message}`);
  const approvedAt = new Date().toISOString();
  await Promise.all([
    supabase.from("case_variants").update({ approved_at: approvedAt }).eq("id", variant.id),
    supabase.from("case_workspaces").update({ status: "approved", updated_at: approvedAt }).eq("id", variant.workspace_id),
  ]);
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
      userRole: item.user_role,
      opponentRole: item.opponent_role,
      additionalRoles: item.additional_roles || [],
      stakes: item.stakes,
      startSituation: item.start_situation,
      difficultyReason: item.difficulty_reason,
      evaluationFocus: item.evaluation_focus,
      methodologyBasis: item.methodology_basis,
      approvedAt: item.approved_at,
    })),
  };
}
