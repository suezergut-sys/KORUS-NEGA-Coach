import { addWorkspaceFiles, createOrUpdateWorkspace, getWorkspaceMaterials, getWorkspaceView, saveGeneratedVariants } from "@/lib/case-db";
import { generateCaseVariants } from "@/lib/case-generator";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const workspaceId = String(form.get("workspaceId") || "").trim() || undefined;
    const title = String(form.get("title") || "Новый кейс").trim().slice(0, 160);
    const notes = String(form.get("notes") || "").trim().slice(0, 20000);
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    const workspace = await createOrUpdateWorkspace({ workspaceId, title, notes });
    await addWorkspaceFiles(workspace.id, files);
    const materials = await getWorkspaceMaterials(workspace.id);
    if (!materials.length && notes.length < 40) {
      return Response.json({ error: "Добавьте материалы или подробное текстовое описание кейса." }, { status: 400 });
    }
    const variants = await generateCaseVariants({
      title,
      notes,
      materials: materials.map((item) => ({ fileName: item.file_name, text: item.extracted_text })),
    });
    await saveGeneratedVariants(workspace.id, variants);
    return Response.json({ workspace: await getWorkspaceView(workspace.id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось проанализировать материалы." }, { status: 500 });
  }
}
