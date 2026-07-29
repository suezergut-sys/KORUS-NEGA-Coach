import { approveVariant } from "@/lib/case-db";
import { after } from "next/server";
import { generateCaseMedia } from "@/lib/case-media";
import { toPublicCase } from "@/lib/case-types";
import { getCurrentCaseAuthor } from "@/lib/case-author";
import { parseCaseVisibility } from "@/lib/case-visibility";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const body = (await request.json()) as { variantId?: string; visibility?: unknown };
    if (!body.variantId) return Response.json({ error: "Не выбран вариант кейса." }, { status: 400 });
    const visibility = parseCaseVisibility(body.visibility);
    if (!visibility) return Response.json({ error: "Выберите, кто сможет отрабатывать кейс." }, { status: 400 });
    const author = await getCurrentCaseAuthor("AI-конструктор");
    const approved = await approveVariant(body.variantId, "builder", author, session.userId, visibility);
    after(async () => { try { await generateCaseMedia(approved.id); } catch { /* status is stored */ } });
    return Response.json({ case: toPublicCase(approved), mediaStatus: "pending" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось утвердить кейс." }, { status: 500 });
  }
}
