import { addWorkspaceFiles, createOrUpdateWorkspace, discardWorkspace, getWorkspaceMaterials, getWorkspaceView, saveGeneratedVariants } from "@/lib/case-db";
import { generateCaseVariants } from "@/lib/case-generator";
import { readBoundedFormData } from "@/lib/bounded-form-data";
import { BUILDER_UPLOAD_REQUEST_BYTES, uploadErrorStatus } from "@/lib/case-upload-constraints";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let createdWorkspaceId: string | null = null;
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const form = await readBoundedFormData(request, BUILDER_UPLOAD_REQUEST_BYTES);
    const workspaceId = String(form.get("workspaceId") || "").trim() || undefined;
    const title = String(form.get("title") || "Новый кейс").trim().slice(0, 160);
    const notes = String(form.get("notes") || "").trim().slice(0, 20000);
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    const workspace = await createOrUpdateWorkspace({ workspaceId, title, notes, ownerUserId: session.userId });
    if (!workspaceId) createdWorkspaceId = workspace.id;
    await addWorkspaceFiles(workspace.id, files, session.userId);
    const materials = await getWorkspaceMaterials(workspace.id, session.userId);
    if (!materials.length && notes.length < 40) {
      return Response.json({ error: "Добавьте материалы или подробное текстовое описание кейса." }, { status: 400 });
    }
    const variants = await generateCaseVariants({
      title,
      notes,
      materials: materials.map((item) => ({ fileName: item.file_name, text: item.extracted_text })),
    });
    await saveGeneratedVariants(workspace.id, variants, session.userId);
    return Response.json({ workspace: await getWorkspaceView(workspace.id, session.userId) });
  } catch (error) {
    if (createdWorkspaceId) await discardWorkspace(createdWorkspaceId, session.userId);
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось проанализировать материалы." }, { status: uploadErrorStatus(error) });
  }
}
