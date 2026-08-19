import {
  GET as getRealtimeStatus,
  createRealtimeSession,
} from "@/app/api/realtime/session/route";
import { rejectNonAdminApiRequest } from "@/lib/admin-api";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const denied = await rejectNonAdminApiRequest();
  return denied || getRealtimeStatus();
}

export async function POST(request: Request) {
  const denied = await rejectNonAdminApiRequest();
  return denied || createRealtimeSession(request, { adminCaseAccess: true, skipTrainingSessionClaim: true });
}
