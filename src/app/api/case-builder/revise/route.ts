import { getVariantForRevision, getWorkspaceView, replaceWorkspaceVariants } from "@/lib/case-db";
import { reviseCaseVariant } from "@/lib/case-generator";
import { parseCaseRevisionInstructions } from "@/lib/case-revision";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const body = (await request.json()) as { variantId?: unknown; instructions?: unknown };
    const variantId = typeof body.variantId === "string" ? body.variantId.trim() : "";
    if (!variantId) return Response.json({ error: "Не выбран вариант для исправления." }, { status: 400 });
    const instructions = parseCaseRevisionInstructions(body.instructions);
    const current = await getVariantForRevision(variantId, session.userId);
    const revised = await reviseCaseVariant(current.variant, instructions);
    await replaceWorkspaceVariants(current.workspaceId, revised, session.userId);
    return Response.json({ workspace: await getWorkspaceView(current.workspaceId, session.userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось исправить вариант кейса.";
    const status = message.includes("Опишите") || message.includes("Не выбран") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
