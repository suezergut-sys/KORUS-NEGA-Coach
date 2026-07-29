import { processCaseMediaQueue } from "@/lib/case-media";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Недопустимый ключ фонового задания." }, { status: 401 });
  }

  try {
    const result = await processCaseMediaQueue(2);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось обработать очередь." },
      { status: 500 },
    );
  }
}
