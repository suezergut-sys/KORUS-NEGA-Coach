import { approveVariant } from "@/lib/case-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { variantId?: string };
    if (!body.variantId) return Response.json({ error: "Не выбран вариант кейса." }, { status: 400 });
    return Response.json({ case: await approveVariant(body.variantId, "builder") });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось утвердить кейс." }, { status: 500 });
  }
}
