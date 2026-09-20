import { getCurrentUserSession } from "@/lib/user-auth";
import { getOneCCaseCreatorAccess } from "@/lib/one-c-case-access";
import { getCurrentCaseAuthor } from "@/lib/case-author";
import { publishPrivateOneCCase } from "@/lib/one-c-case-publisher";
import { enqueueCaseMedia } from "@/lib/case-media";
import { recordUserActivity } from "@/lib/user-activity-monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 250_000) return Response.json({ error: "Кейс слишком большой для публикации." }, { status: 413 });
  try {
    const access = await getOneCCaseCreatorAccess(session);
    if (!access.allowed || !access.departmentId) return Response.json({ error: "Конструктор доступен только сотрудникам 1С." }, { status: 403 });
    const author = await getCurrentCaseAuthor("Конструктор кейсов 1С");
    const published = await publishPrivateOneCCase(await request.json(), session.userId, access.departmentId, author);
    await enqueueCaseMedia(published.id);
    await recordUserActivity({ userId: session.userId, type: "case_created", entityId: published.id, subjectTitle: published.title });
    return Response.json({ case: published, mediaStatus: "pending" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось опубликовать кейс 1С.";
    const status = message.includes("Заполните") || message.includes("Для каждой роли") || message.includes("должен содержать") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
