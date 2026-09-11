import { createRealtimeSession, GET as health } from "@/app/api/realtime/session/route";

export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = health;

export async function POST(request: Request) {
  return createRealtimeSession(request, { engine: "live" });
}
