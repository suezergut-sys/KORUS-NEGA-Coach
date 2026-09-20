import { getCurrentUserSession } from "@/lib/user-auth";
import { getOneCCaseCreatorAccess } from "@/lib/one-c-case-access";
import { parseOneCCaseBrief } from "@/lib/one-c-case-input";
import { generateOneCCase } from "@/lib/one-c-case-generator";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 100_000) return Response.json({ error: "Описание кейса слишком большое." }, { status: 413 });
  try {
    const access = await getOneCCaseCreatorAccess(session);
    if (!access.allowed) return Response.json({ error: "Конструктор доступен только сотрудникам 1С." }, { status: 403 });
    const brief = parseOneCCaseBrief(await request.json());
    return Response.json({ case: await generateOneCCase(brief) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сформировать кейс 1С.";
    const status = message.includes("минимум 40") || message.includes("Укажите, что") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
