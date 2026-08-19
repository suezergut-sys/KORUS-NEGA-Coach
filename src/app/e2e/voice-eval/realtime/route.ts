import {
  GET as getRealtimeSession,
  createRealtimeSession,
} from "@/app/api/realtime/session/route";

function unavailable() {
  return Response.json({ error: "Маршрут доступен только в режиме голосовых eval-тестов." }, { status: 404 });
}

export async function GET() {
  if (process.env.E2E_TEST_MODE !== "1") return unavailable();
  return getRealtimeSession();
}

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== "1") return unavailable();
  return createRealtimeSession(request, { skipTrainingSessionClaim: true });
}
