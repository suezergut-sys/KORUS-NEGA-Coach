import { approveVariant } from "@/lib/case-db";
import { after } from "next/server";
import { generateCaseMedia } from "@/lib/case-media";
import { toPublicCase } from "@/lib/case-types";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { variantId?: string };
    if (!body.variantId) return Response.json({ error: "Не выбран вариант кейса." }, { status: 400 });
    const user = await getCurrentUserSession();
    const approved = await approveVariant(body.variantId, "builder", user?.email ? `AI-конструктор · ${user.email}` : "AI-конструктор");
    after(async () => { try { await generateCaseMedia(approved.id); } catch { /* status is stored */ } });
    return Response.json({ case: toPublicCase(approved), mediaStatus: "pending" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось утвердить кейс." }, { status: 500 });
  }
}
