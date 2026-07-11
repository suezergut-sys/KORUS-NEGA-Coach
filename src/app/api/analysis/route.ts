import { ANALYSIS_MODEL, EMBEDDING_MODEL, getOpenAI } from "@/lib/openai-server";
import { createNegotiationAnalysisSchema, type NegotiationAnalysis } from "@/lib/analysis-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type InputTurn = {
  id: string;
  author: "Вы" | "Оппонент" | "Система";
  text: string;
  time: string;
};

type AnalysisRequest = {
  caseId?: string;
  caseCode?: string;
  caseContext?: string;
  caseGoal?: string;
  caseConstraints?: string[];
  opponentName?: string;
  opponentVoice?: string;
  startedAt?: string;
  durationSeconds?: number;
  turns?: InputTurn[];
};

type RetrievedChunk = {
  id: number;
  section_path: string;
  content: string;
  similarity: number;
};

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeQuote(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
}

export async function GET() {
  const configured = Boolean(
    process.env.OPENAI_API_KEY &&
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return Response.json({ configured }, { status: configured ? 200 : 503 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisRequest;
    const turns = (body.turns || [])
      .slice(-80)
      .map((turn) => ({
        id: clean(turn.id, 120),
        author: turn.author,
        text: clean(turn.text, 2000),
        time: clean(turn.time, 20),
      }))
      .filter((turn) => turn.text && (turn.author === "Вы" || turn.author === "Оппонент"));

    if (turns.length < 2 || !turns.some((turn) => turn.author === "Вы")) {
      return Response.json(
        { error: "Для анализа нужны минимум две содержательные реплики, включая реплику пользователя." },
        { status: 400 },
      );
    }

    const caseContext = clean(body.caseContext, 5000);
    const caseGoal = clean(body.caseGoal, 3000);
    const caseConstraints = (body.caseConstraints || []).map((item) => clean(item, 1000)).filter(Boolean).slice(0, 10);
    const transcript = turns
      .map((turn, index) => `${index + 1}. ${turn.author}: ${turn.text}`)
      .join("\n")
      .slice(0, 24000);

    const openai = getOpenAI();
    const supabase = getSupabaseAdmin();
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: `${caseContext}\n${caseGoal}\n${caseConstraints.join("\n")}\n\n${transcript}`.slice(0, 28000),
      encoding_format: "float",
    });

    const { data: chunksData, error: chunksError } = await supabase.rpc("match_method_chunks", {
      query_embedding: embeddingResponse.data[0].embedding,
      match_threshold: 0.3,
      match_count: 8,
    });
    if (chunksError) throw new Error(`RAG: ${chunksError.message}`);

    const chunks = (chunksData || []) as RetrievedChunk[];
    if (!chunks.length) {
      return Response.json(
        { error: "Методическая база пока пуста. Сначала импортируйте книгу." },
        { status: 503 },
      );
    }

    const { data: methodSource } = await supabase
      .from("method_sources")
      .select("verification_status, methodology_version")
      .eq("code", "SRC-001")
      .single();
    const methodologyStatus = methodSource?.verification_status === "verified" ? "verified" : "candidate";
    const methodologyVersion = String(methodSource?.methodology_version || "tarasov-v0-candidate");
    const chunkIds = chunks.map((chunk) => chunk.id);
    const atomSelect = "id, chunk_id, kind, title, statement, source_quote, verification_status, methodology_version";
    const atomsResult = methodologyStatus === "verified"
      ? await supabase.from("method_atoms").select(atomSelect).eq("verification_status", "verified").limit(60)
      : await supabase.from("method_atoms").select(atomSelect).in("chunk_id", chunkIds).neq("verification_status", "rejected").limit(30);
    if (atomsResult.error) throw new Error(`Методические атомы: ${atomsResult.error.message}`);
    const atoms = atomsResult.data || [];
    const atomChunkIds = [...new Set(atoms.map((atom) => atom.chunk_id).filter(Boolean))];
    const { data: atomChunks } = await supabase
      .from("document_chunks")
      .select("id,section_path")
      .in("id", atomChunkIds);
    const atomSectionMap = new Map((atomChunks || []).map((chunk) => [chunk.id, chunk.section_path]));

    const sources = chunks
      .map(
        (chunk, index) =>
          `[ИСТОЧНИК ${index + 1}] Раздел: ${chunk.section_path}\n${chunk.content}`,
      )
      .join("\n\n");
    const atomContext = atoms
      .map(
        (atom) =>
          `[АТОМ ${atom.id}] [${atom.verification_status}] ${atom.kind}: ${atom.title}\nРаздел: ${atomSectionMap.get(atom.chunk_id) || "Не указан"}\n${atom.statement}\nЦитата: ${atom.source_quote}`,
      )
      .join("\n\n");

    const response = await openai.responses.create({
      model: ANALYSIS_MODEL,
      reasoning: { effort: "medium" },
      instructions: `
Ты анализируешь русскоязычный управленческий поединок по предоставленным фрагментам книги Владимира Тарасова.
Не используй память о книге и не придумывай названия стратагем. Каждый методический вывод должен опираться на точную цитату из блока ИСТОЧНИК или АТОМ.
sourceQuote копируй дословно. turnQuote копируй дословно из стенограммы.
Определи победителя: user — человек достиг своей цели лучше оппонента; opponent — оппонент сохранил контроль и человек не продвинул цель; draw — стороны пришли к сбалансированному исходу или данных недостаточно. Не объявляй победу только за вежливость или красноречие.
Дай персональную обратную связь именно человеку. В techniqueReview разбери как успешные, так и частичные/упущенные приёмы; каждый пункт обязан содержать прямую цитату человека из стенограммы и точную цитату методологии.
methodologyAtomId копируй из метки [АТОМ id]. Если подходящего атома нет, оставь пустую строку, но не выдумывай id.
developmentPlan должен содержать конкретные упражнения и формулировки, которые пользователь сможет внедрить в свой переговорный арсенал.
Если материала недостаточно, прямо укажи это и снизь confidence.
Статус базы: ${methodologyStatus}. Версия: ${methodologyVersion}.
При статусе candidate оценка предварительная: не называй кандидаты подтверждёнными правилами автора.
Пиши кратко, конкретно и по-русски.
      `.trim(),
      input: `
КОНТЕКСТ КЕЙСА:
${caseContext}

ЦЕЛЬ ЧЕЛОВЕКА:
${caseGoal || "Явно не указана; восстанови только из контекста кейса и стенограммы."}

ОГРАНИЧЕНИЯ:
${caseConstraints.length ? caseConstraints.map((item) => `- ${item}`).join("\n") : "Не указаны."}

СТЕНОГРАММА:
${transcript}

МЕТОДИЧЕСКИЕ АТОМЫ:
${atomContext || "Проверенных атомов пока нет."}

ФРАГМЕНТЫ ИСТОЧНИКА:
${sources}
      `.trim(),
      text: {
        format: {
          type: "json_schema",
          name: "negotiation_analysis",
          strict: true,
          schema: createNegotiationAnalysisSchema(atoms.map((atom) => atom.id)),
        },
      },
    });

    const analysis = JSON.parse(response.output_text) as NegotiationAnalysis;
    analysis.methodologyStatus = methodologyStatus;
    analysis.methodologyVersion = methodologyVersion;
    analysis.disclaimer = methodologyStatus === "verified"
      ? "Оценка основана на верифицированной версии методической базы."
      : "Предварительный анализ: методические атомы ещё должны быть проверены экспертом.";

    const sourceCorpus = [
      ...chunks.map((chunk) => normalizeQuote(chunk.content)),
      ...atoms.map((atom) => normalizeQuote(atom.source_quote)),
    ].join("\n");
    const turnCorpus = turns.map((turn) => normalizeQuote(turn.text)).join("\n");
    const atomIds = new Set(atoms.map((atom) => atom.id));
    analysis.evidence = analysis.evidence.filter(
      (item) =>
        item.sourceQuote.length >= 12 &&
        sourceCorpus.includes(normalizeQuote(item.sourceQuote)) &&
        turnCorpus.includes(normalizeQuote(item.turnQuote)),
    );
    analysis.techniqueReview = analysis.techniqueReview.filter(
      (item) =>
        item.sourceQuote.length >= 12 &&
        item.turnQuote.length >= 4 &&
        sourceCorpus.includes(normalizeQuote(item.sourceQuote)) &&
        turnCorpus.includes(normalizeQuote(item.turnQuote)) &&
        (!item.methodologyAtomId || atomIds.has(item.methodologyAtomId)),
    );

    const startedAt = body.startedAt && !Number.isNaN(Date.parse(body.startedAt))
      ? body.startedAt
      : new Date(Date.now() - Math.max(0, Number(body.durationSeconds || 0)) * 1000).toISOString();
    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .insert({
        case_id: clean(body.caseId, 80) || null,
        case_code: clean(body.caseCode, 120) || "missed-project-deadline",
        case_context: caseContext,
        opponent_name: clean(body.opponentName, 160) || "Виртуальный оппонент",
        opponent_voice: clean(body.opponentVoice, 80) || "marin",
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.max(0, Math.round(Number(body.durationSeconds || 0))),
        methodology_version: methodologyVersion,
        status: "analyzed",
      })
      .select("id")
      .single();
    if (sessionError) throw new Error(`Сессия: ${sessionError.message}`);

    const { data: savedTurns, error: turnsError } = await supabase
      .from("turns")
      .insert(
        turns.map((turn, sequence) => ({
          session_id: session.id,
          sequence,
          speaker: turn.author === "Вы" ? "user" : "opponent",
          text: turn.text,
          client_event_id: turn.id,
          spoken_at: turn.time,
        })),
      )
      .select("id, text");
    if (turnsError) throw new Error(`Реплики: ${turnsError.message}`);

    const { data: evaluation, error: evaluationError } = await supabase
      .from("evaluations")
      .insert({
        session_id: session.id,
        analysis_model: ANALYSIS_MODEL,
        methodology_version: methodologyVersion,
        methodology_status: methodologyStatus,
        overall_score: analysis.overallScore,
        summary: analysis.summary,
        result: analysis,
      })
      .select("id")
      .single();
    if (evaluationError) throw new Error(`Оценка: ${evaluationError.message}`);

    if (analysis.evidence.length) {
      await supabase.from("evaluation_evidence").insert(
        analysis.evidence.map((item) => {
          const turn = (savedTurns || []).find((saved) =>
            normalizeQuote(saved.text).includes(normalizeQuote(item.turnQuote)),
          );
          return {
            evaluation_id: evaluation.id,
            turn_id: turn?.id || null,
            turn_quote: item.turnQuote,
            source_quote: item.sourceQuote,
            section_path: item.section,
            rationale: item.rationale,
            confidence: item.confidence,
          };
        }),
      );
    }

    return Response.json({ sessionId: session.id, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить методический анализ.";
    return Response.json({ error: message }, { status: 500 });
  }
}
