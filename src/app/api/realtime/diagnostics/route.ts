import { getCurrentUserSession } from "@/lib/user-auth";
import { parseRealtimeDiagnostic } from "@/lib/realtime-diagnostics";

export async function POST(request: Request) {
  const user = await getCurrentUserSession();
  if (!user) return Response.json({ error: "Требуется авторизация." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  }
  try {
    const diagnostic = parseRealtimeDiagnostic(await request.json());
    console.info("[realtime-diagnostic]", JSON.stringify({
      ...diagnostic,
      userId: user.userId,
      occurredAt: new Date().toISOString(),
    }));
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Некорректное событие." }, { status: 400 });
  }
}
