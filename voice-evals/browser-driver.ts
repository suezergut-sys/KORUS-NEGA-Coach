import type { Page } from "@playwright/test";
import type { VoiceEvalRecord } from "@/lib/voice-eval";

export async function installVoiceEvalBridge(page: Page) {
  await page.addInitScript(() => {
    const records: VoiceEvalRecord[] = [];
    let context: AudioContext | null = null;
    let destination: MediaStreamAudioDestinationNode | null = null;
    let silenceSource: OscillatorNode | null = null;

    const ensureAudio = async () => {
      if (!context) context = new AudioContext({ sampleRate: 48_000 });
      if (!destination) {
        destination = context.createMediaStreamDestination();
        const silentGain = context.createGain();
        silentGain.gain.value = 0;
        silenceSource = context.createOscillator();
        silenceSource.connect(silentGain).connect(destination);
        silenceSource.start();
      }
      if (context.state !== "running") await context.resume();
      return { context, destination };
    };

    window.__VOICE_EVAL__ = {
      async createInputStream() {
        const audio = await ensureAudio();
        return audio.destination.stream;
      },
      record(record) {
        records.push(structuredClone(record));
      },
      async playAudioBase64(base64) {
        const audio = await ensureAudio();
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const buffer = await audio.context.decodeAudioData(bytes.buffer.slice(0));
        const source = audio.context.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.start();
        await new Promise<void>((resolve) => { source.onended = () => resolve(); });
        source.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 600));
        return buffer.duration * 1_000;
      },
      async playNoise(durationMs, amplitude) {
        const audio = await ensureAudio();
        const frameCount = Math.max(1, Math.floor(audio.context.sampleRate * durationMs / 1_000));
        const buffer = audio.context.createBuffer(1, frameCount, audio.context.sampleRate);
        const samples = buffer.getChannelData(0);
        let seed = 0x51f15e;
        for (let index = 0; index < samples.length; index += 1) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          samples[index] = ((seed >>> 0) / 0xffffffff * 2 - 1) * amplitude;
        }
        const source = audio.context.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.start();
        await new Promise<void>((resolve) => { source.onended = () => resolve(); });
        source.disconnect();
      },
      readRecords() {
        return structuredClone(records);
      },
    };
  });
}

export async function readVoiceEvalRecords(page: Page) {
  return page.evaluate(() => window.__VOICE_EVAL__?.readRecords?.() || []);
}

export async function playVoiceEvalAudio(page: Page, base64: string) {
  return page.evaluate(async (audio) => {
    const play = window.__VOICE_EVAL__?.playAudioBase64;
    if (!play) throw new Error("Голосовой eval-драйвер не готов.");
    return play(audio);
  }, base64);
}

export async function playVoiceEvalNoise(page: Page, durationMs: number, amplitude = 0.08) {
  return page.evaluate(async ({ duration, level }) => {
    const play = window.__VOICE_EVAL__?.playNoise;
    if (!play) throw new Error("Голосовой eval-драйвер не готов.");
    await play(duration, level);
  }, { duration: durationMs, level: amplitude });
}

export async function waitForVoiceEvalRecord(
  page: Page,
  predicate: { source: VoiceEvalRecord["source"]; name: string; afterAtMs?: number },
  timeoutMs = 30_000,
) {
  await page.waitForFunction(({ source, name, afterAtMs }) => {
    const records = window.__VOICE_EVAL__?.readRecords?.() || [];
    return records.some((record) => record.source === source && record.name === name && record.atMs > (afterAtMs || 0));
  }, predicate, { timeout: timeoutMs });
  const records = await readVoiceEvalRecords(page);
  return records.findLast((record) => record.source === predicate.source && record.name === predicate.name && record.atMs > (predicate.afterAtMs || 0));
}
