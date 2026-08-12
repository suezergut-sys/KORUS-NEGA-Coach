import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { DEFAULT_CASE } from "@/lib/default-case";
import { evaluateVoiceEvalTrace } from "@/lib/voice-eval-evaluation";
import type { VoiceEvalRecord } from "@/lib/voice-eval";
import {
  installVoiceEvalBridge,
  playVoiceEvalAudio,
  playVoiceEvalNoise,
  readVoiceEvalRecords,
  waitForVoiceEvalRecord,
} from "./browser-driver";
import { judgeSemanticGrounding, synthesizeUserPhrase } from "./openai-support";
import { VOICE_EVAL_SCENARIOS, type VoiceEvalScenario } from "./scenarios";

const liveEnabled = process.env.RUN_LIVE_VOICE_EVALS === "1" && Boolean(process.env.OPENAI_API_KEY);

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2), "utf8"),
    contentType: "application/json",
  });
}

function latestAt(records: readonly VoiceEvalRecord[]) {
  return records.reduce((latest, record) => Math.max(latest, record.atMs), 0);
}

async function startVoiceSession(page: Page) {
  await installVoiceEvalBridge(page);
  await page.goto("/e2e/voice-eval");
  await page.getByRole("button", { name: "НАЧАТЬ" }).click();
  await waitForVoiceEvalRecord(page, { source: "diagnostic", name: "session_started" }, 45_000);
}

async function waitForOpponentPlaybackToFinish(page: Page, afterAtMs = 0) {
  return waitForVoiceEvalRecord(page, {
    source: "realtime",
    name: "output_audio_buffer.stopped",
    afterAtMs,
  }, 45_000);
}

async function speak(page: Page, text: string, testInfo: TestInfo) {
  const audio = await synthesizeUserPhrase(text);
  await testInfo.attach(`human-${createSafeName(text)}.mp3`, {
    path: audio.filePath,
    contentType: "audio/mpeg",
  });
  await playVoiceEvalAudio(page, audio.bytes.toString("base64"));
}

function createSafeName(text: string) {
  return text.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 48);
}

async function finishAndGrade(page: Page, scenario: VoiceEvalScenario, testInfo: TestInfo) {
  const records = await readVoiceEvalRecords(page);
  const traceResult = evaluateVoiceEvalTrace(records, scenario.trace);
  await attachJson(testInfo, `${scenario.id}-trace.json`, records);
  await attachJson(testInfo, `${scenario.id}-technical-grade.json`, traceResult);
  expect(traceResult.failures, traceResult.failures.join("\n")).toEqual([]);

  if (scenario.semanticGrounding) {
    const semanticResult = await judgeSemanticGrounding(records);
    await attachJson(testInfo, `${scenario.id}-semantic-grade.json`, semanticResult);
    expect(semanticResult, JSON.stringify(semanticResult, null, 2)).toMatchObject({ passed: true });
  }
}

test.describe("живые голосовые eval-сценарии", () => {
  test.skip(!liveEnabled, "Запускаются командой npm run test:voice-evals при настроенном OPENAI_API_KEY.");

  test.afterEach(async ({ page }, testInfo) => {
    if (page.isClosed()) return;
    await attachJson(testInfo, `${testInfo.title}-raw-trace.json`, await readVoiceEvalRecords(page));
  });

  test("обычный диалог", async ({ page }, testInfo) => {
    const scenario = VOICE_EVAL_SCENARIOS.normalDialogue;
    await startVoiceSession(page);
    const firstPlayback = await waitForOpponentPlaybackToFinish(page);
    await speak(page, scenario.userPhrases[0], testInfo);
    const userTurn = await waitForVoiceEvalRecord(page, {
      source: "realtime",
      name: "conversation.item.input_audio_transcription.completed",
      afterAtMs: firstPlayback?.atMs,
    }, 30_000);
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "response.done", afterAtMs: userTurn?.atMs }, 45_000);
    await finishAndGrade(page, scenario, testInfo);
  });

  test("одно перебивание", async ({ page }, testInfo) => {
    const scenario = VOICE_EVAL_SCENARIOS.singleInterruption;
    await startVoiceSession(page);
    const playback = await waitForVoiceEvalRecord(page, { source: "realtime", name: "output_audio_buffer.started" }, 45_000);
    await page.waitForTimeout(650);
    await speak(page, scenario.userPhrases[0], testInfo);
    const interruption = await waitForVoiceEvalRecord(page, {
      source: "diagnostic",
      name: "interruption_confirmed",
      afterAtMs: playback?.atMs,
    }, 30_000);
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "response.done", afterAtMs: interruption?.atMs }, 45_000);
    await finishAndGrade(page, scenario, testInfo);
  });

  test("повторное перебивание меняет внутреннее состояние", async ({ page }, testInfo) => {
    const scenario = VOICE_EVAL_SCENARIOS.repeatedInterruption;
    await startVoiceSession(page);
    let cursor = 0;
    for (const phrase of scenario.userPhrases) {
      const playback = await waitForVoiceEvalRecord(page, {
        source: "realtime",
        name: "output_audio_buffer.started",
        afterAtMs: cursor,
      }, 45_000);
      await page.waitForTimeout(650);
      await speak(page, phrase, testInfo);
      const interruption = await waitForVoiceEvalRecord(page, {
        source: "diagnostic",
        name: "interruption_confirmed",
        afterAtMs: playback?.atMs,
      }, 30_000);
      cursor = interruption?.atMs || latestAt(await readVoiceEvalRecords(page));
    }
    await waitForVoiceEvalRecord(page, {
      source: "realtime",
      name: "response.output_audio_transcript.done",
      afterAtMs: cursor,
    }, 45_000);
    const records = await readVoiceEvalRecords(page);
    const tones = records
      .filter((record) => record.source === "diagnostic" && record.name === "emotion_shift")
      .map((record) => record.details.tone);
    expect(tones.slice(-2)).toEqual(["guarded", "irritated"]);
    await finishAndGrade(page, scenario, testInfo);
  });

  test("длинная пауза не запускает преждевременный ответ", async ({ page }, testInfo) => {
    const scenario = VOICE_EVAL_SCENARIOS.longPause;
    await startVoiceSession(page);
    const firstPlayback = await waitForOpponentPlaybackToFinish(page);
    const beforeFragment = await readVoiceEvalRecords(page);
    await speak(page, scenario.userPhrases[0], testInfo);
    await page.waitForTimeout(3_000);
    const duringPause = await readVoiceEvalRecords(page);
    const responsesBefore = beforeFragment.filter((record) => record.source === "realtime" && record.name === "response.created").length;
    const responsesDuring = duringPause.filter((record) => record.source === "realtime" && record.name === "response.created").length;
    expect(responsesDuring, "Модель начала отвечать на незавершённый фрагмент").toBe(responsesBefore);
    await speak(page, scenario.userPhrases[1], testInfo);
    const userTurn = await waitForVoiceEvalRecord(page, {
      source: "realtime",
      name: "conversation.item.input_audio_transcription.completed",
      afterAtMs: firstPlayback?.atMs,
    }, 30_000);
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "response.done", afterAtMs: userTurn?.atMs }, 45_000);
    await finishAndGrade(page, scenario, testInfo);
  });

  test("посторонний шум не считается перебиванием", async ({ page }, testInfo) => {
    const scenario = VOICE_EVAL_SCENARIOS.backgroundNoise;
    await startVoiceSession(page);
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "output_audio_buffer.started" }, 45_000);
    await page.waitForTimeout(650);
    await playVoiceEvalNoise(page, 900, 0.08);
    await page.waitForTimeout(3_500);
    await finishAndGrade(page, scenario, testInfo);
  });

  test("неопределённая реплика не приводит к выдуманным фактам", async ({ page }, testInfo) => {
    const scenario = VOICE_EVAL_SCENARIOS.hallucinationTrap;
    await startVoiceSession(page);
    const firstPlayback = await waitForOpponentPlaybackToFinish(page);
    await speak(page, scenario.userPhrases[0], testInfo);
    const userTurn = await waitForVoiceEvalRecord(page, {
      source: "realtime",
      name: "conversation.item.input_audio_transcription.completed",
      afterAtMs: firstPlayback?.atMs,
    }, 30_000);
    await waitForVoiceEvalRecord(page, { source: "realtime", name: "response.done", afterAtMs: userTurn?.atMs }, 45_000);
    await finishAndGrade(page, scenario, testInfo);
  });
});

test("набор сценариев использует закрытый тестовый кейс", () => {
  expect(DEFAULT_CASE.id).toBe("default-missed-project-deadline");
  expect(Object.values(VOICE_EVAL_SCENARIOS).map((scenario) => scenario.id)).toEqual([
    "normal-dialogue",
    "single-interruption",
    "repeated-interruption",
    "long-pause",
    "background-noise",
    "hallucination-trap",
  ]);
});
