import { buildRealtimeInstructions } from "@/lib/prompt";
import { resolvePublishedCase, selectCaseRoles } from "@/lib/case-resolver";

export const runtime = "nodejs";
export const maxDuration = 30;

function readParam(url: URL, key: string, fallback: string) {
  return (url.searchParams.get(key) || fallback).slice(0, 1200);
}

export async function GET() {
  return Response.json(
    { configured: Boolean(process.env.OPENAI_API_KEY) },
    { status: process.env.OPENAI_API_KEY ? 200 : 503 },
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "На сервере не настроен OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const sdp = (await request.text()).slice(0, 100_000);
  const requestedVoice = readParam(url, "voice", "marin");
  const voice = requestedVoice === "cedar" ? "cedar" : "marin";
  const caseId = readParam(url, "caseId", "");
  const negotiationCase = await resolvePublishedCase(caseId, readParam(url, "caseCode", ""));
  if (!negotiationCase) return Response.json({ error: "Опубликованный кейс не найден." }, { status: 404 });
  const selected = selectCaseRoles(
    negotiationCase,
    Number(readParam(url, "participantRoleIndex", "0")),
    Number(readParam(url, "opponentRoleIndex", "1")),
  );
  const userRole = selected.participantRole;
  const opponentRole = selected.opponentRole;
  const instructions = buildRealtimeInstructions({
    role: `${opponentRole.name}, ${opponentRole.position}`,
    difficulty: readParam(url, "difficulty", "Средняя"),
    context: negotiationCase.situation,
    conflict: negotiationCase.conflict,
    startSituation: negotiationCase.startSituation,
    stakes: negotiationCase.stakes,
    userRole,
    opponentRole,
  });

  if (!sdp.startsWith("v=0")) {
    return Response.json({ error: "Некорректное SDP-предложение." }, { status: 400 });
  }

  const sessionConfig = {
    type: "realtime",
    model: "gpt-realtime-2",
    output_modalities: ["audio"],
    reasoning: { effort: "low" },
    instructions,
    audio: {
      input: {
        transcription: {
          model: "gpt-realtime-whisper",
          language: "ru",
          delay: "minimal",
        },
        turn_detection: {
          type: "semantic_vad",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice },
    },
  };

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(sessionConfig));

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const responseBody = await openaiResponse.text();

    if (!openaiResponse.ok) {
      let message = "OpenAI не открыл Realtime-сессию.";
      try {
        const parsed = JSON.parse(responseBody) as { error?: { message?: string } };
        message = parsed.error?.message || message;
      } catch {
        // OpenAI can return a plain-text error; do not expose the whole response.
      }
      return Response.json({ error: message }, { status: openaiResponse.status });
    }

    return new Response(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch {
    return Response.json(
      { error: "Не удалось связаться с OpenAI Realtime API." },
      { status: 502 },
    );
  }
}
