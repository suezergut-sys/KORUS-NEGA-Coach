import { addWorkspaceFiles, approveVariant, createOrUpdateWorkspace, discardWorkspace, getWorkspaceMaterials, saveGeneratedVariants } from "@/lib/case-db";
import { generateCaseVariants } from "@/lib/case-generator";
import { after } from "next/server";
import { generateCaseMedia } from "@/lib/case-media";
import { toPublicCase } from "@/lib/case-types";
import { readBoundedFormData } from "@/lib/bounded-form-data";
import { QUICK_UPLOAD_REQUEST_BYTES, uploadErrorStatus } from "@/lib/case-upload-constraints";
import { getCurrentCaseAuthor } from "@/lib/case-author";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let workspaceId: string | null = null;
  let published = false;
  try {
    const form = await readBoundedFormData(request, QUICK_UPLOAD_REQUEST_BYTES);
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Выберите текстовый файл с описанием кейса." }, { status: 400 });
    const title = String(form.get("title") || file.name.replace(/\.[^.]+$/, "")).trim().slice(0, 160);
    const workspace = await createOrUpdateWorkspace({ title, notes: "Быстрая загрузка одного файла" });
    workspaceId = workspace.id;
    await addWorkspaceFiles(workspace.id, [file]);
    const materials = await getWorkspaceMaterials(workspace.id);
    const variants = await generateCaseVariants({
      title,
      notes: "Сформируй один основной кейс из загруженного описания; дополнительные варианты нужны как резерв.",
      materials: materials.map((item) => ({ fileName: item.file_name, text: item.extracted_text })),
    });
    const saved = await saveGeneratedVariants(workspace.id, variants);
    const author = await getCurrentCaseAuthor("Пользователь (быстрая загрузка)");
    const approved = await approveVariant(saved[0].id, "quick_upload", author);
    published = true;
    after(async () => { try { await generateCaseMedia(approved.id); } catch { /* status is stored */ } });
    return Response.json({
      case: toPublicCase(approved),
      alternativesCreated: saved.length - 1,
    });
  } catch (error) {
    if (workspaceId && !published) await discardWorkspace(workspaceId);
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить и подготовить кейс." }, { status: uploadErrorStatus(error) });
  }
}
