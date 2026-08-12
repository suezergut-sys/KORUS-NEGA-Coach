import { rejectNonAdminApiRequest } from "@/lib/admin-api";
import { resolvePublishedCaseForAdmin, selectCaseRoles } from "@/lib/case-resolver";
import { generatePlatformTestHumanTurn } from "@/lib/platform-test-server";
import type { PlatformTestTurn } from "@/lib/platform-test";

export const runtime = "nodejs";
export const maxDuration = 60;

type HumanTurnRequest = {
  caseId?: unknown;
  participantRoleIndex?: unknown;
  opponentRoleIndex?: unknown;
  turnIndex?: unknown;
  turns?: unknown;
};

function normalizeTurns(value: unknown): PlatformTestTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-40).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const speaker = candidate.speaker === "human" || candidate.speaker === "opponent" ? candidate.speaker : null;
    const text = typeof candidate.text === "string" ? candidate.text.replace(/\s+/g, " ").trim().slice(0, 2_000) : "";
    if (!speaker || !text) return [];
    return [{ id: String(candidate.id || `turn-${index}`).slice(0, 120), speaker, text, atMs: Number(candidate.atMs) || 0 }];
  });
}

export async function POST(request: Request) {
  const denied = await rejectNonAdminApiRequest();
  if (denied) return denied;

  try {
    const raw = await request.text();
    if (raw.length > 120_000) return Response.json({ error: "Стенограмма слишком велика." }, { status: 413 });
    const body = JSON.parse(raw) as HumanTurnRequest;
    const caseId = typeof body.caseId === "string" ? body.caseId.slice(0, 120) : "";
    const negotiationCase = await resolvePublishedCaseForAdmin(caseId);
    if (!negotiationCase) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });
    const selected = selectCaseRoles(negotiationCase, Number(body.participantRoleIndex), Number(body.opponentRoleIndex));
    const result = await generatePlatformTestHumanTurn({
      negotiationCase,
      participantRole: selected.participantRole,
      opponentRole: selected.opponentRole,
      turns: normalizeTurns(body.turns),
      turnIndex: Math.max(1, Math.min(100, Number(body.turnIndex) || 1)),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Platform test participant generation failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать реплику AI-участника." }, { status: 500 });
  }
}
