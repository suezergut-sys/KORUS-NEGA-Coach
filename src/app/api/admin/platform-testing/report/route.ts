import { rejectNonAdminApiRequest } from "@/lib/admin-api";
import { resolvePublishedCaseForAdmin } from "@/lib/case-resolver";
import { createPlatformTestReport } from "@/lib/platform-test-server";
import type { PlatformTestTraceEvent, PlatformTestTurn } from "@/lib/platform-test";

export const runtime = "nodejs";
export const maxDuration = 90;

type ReportRequest = {
  caseId?: unknown;
  durationSeconds?: unknown;
  turns?: unknown;
  events?: unknown;
};

function normalizeTurns(value: unknown): PlatformTestTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const speaker = candidate.speaker === "human" || candidate.speaker === "opponent" ? candidate.speaker : null;
    const text = typeof candidate.text === "string" ? candidate.text.replace(/\s+/g, " ").trim().slice(0, 2_000) : "";
    if (!speaker || !text) return [];
    const recognizedText = typeof candidate.recognizedText === "string"
      ? candidate.recognizedText.replace(/\s+/g, " ").trim().slice(0, 2_000)
      : undefined;
    return [{ id: String(candidate.id || `turn-${index}`).slice(0, 120), speaker, text, recognizedText, atMs: Math.max(0, Number(candidate.atMs) || 0) }];
  });
}

function scalarDetails(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const details: NonNullable<PlatformTestTraceEvent["details"]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (typeof raw === "string") details[key.slice(0, 80)] = raw.slice(0, 1_000);
    else if (typeof raw === "number" && Number.isFinite(raw)) details[key.slice(0, 80)] = raw;
    else if (typeof raw === "boolean" || raw === null) details[key.slice(0, 80)] = raw;
  }
  return details;
}

function normalizeEvents(value: unknown): PlatformTestTraceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const type = typeof candidate.type === "string" ? candidate.type.trim().slice(0, 160) : "";
    if (!type) return [];
    return [{ atMs: Math.max(0, Number(candidate.atMs) || 0), type, details: scalarDetails(candidate.details) }];
  });
}

export async function POST(request: Request) {
  const denied = await rejectNonAdminApiRequest();
  if (denied) return denied;

  try {
    const raw = await request.text();
    if (raw.length > 500_000) return Response.json({ error: "Данные теста слишком велики." }, { status: 413 });
    const body = JSON.parse(raw) as ReportRequest;
    const caseId = typeof body.caseId === "string" ? body.caseId.slice(0, 120) : "";
    const negotiationCase = await resolvePublishedCaseForAdmin(caseId);
    if (!negotiationCase) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });
    const report = await createPlatformTestReport({
      negotiationCase,
      durationSeconds: Math.max(0, Math.min(3_600, Number(body.durationSeconds) || 0)),
      turns: normalizeTurns(body.turns),
      events: normalizeEvents(body.events),
    });
    return Response.json({ report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Platform test report failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сформировать отчёт." }, { status: 500 });
  }
}
