import { addWorkspaceFiles, approveVariant, createOrUpdateWorkspace, getWorkspaceMaterials, saveGeneratedVariants } from "@/lib/case-db";
import { generateCaseVariants } from "@/lib/case-generator";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Выберите текстовый файл с описанием кейса." }, { status: 400 });
    const title = String(form.get("title") || file.name.replace(/\.[^.]+$/, "")).trim().slice(0, 160);
    const workspace = await createOrUpdateWorkspace({ title, notes: "Быстрая загрузка одного файла" });
    await addWorkspaceFiles(workspace.id, [file]);
    const materials = await getWorkspaceMaterials(workspace.id);
    const variants = await generateCaseVariants({
      title,
      notes: "Сформируй один основной кейс из загруженного описания; дополнительные варианты нужны как резерв.",
      materials: materials.map((item) => ({ fileName: item.file_name, text: item.extracted_text })),
    });
    const saved = await saveGeneratedVariants(workspace.id, variants);
    const approved = await approveVariant(saved[0].id, "quick_upload");
    return Response.json({ case: { ...approved, opponentRole: { ...approved.opponentRole, hiddenMotives: [] } }, alternativesCreated: saved.length - 1 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить и подготовить кейс." }, { status: 500 });
  }
}
