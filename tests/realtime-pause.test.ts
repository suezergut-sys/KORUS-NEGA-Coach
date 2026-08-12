import { describe, expect, it } from "vitest";
import { buildPauseRealtimeEvents, buildRealtimeResponseEvent, buildResumeRealtimeEvents, requestRealtimeResponse } from "@/lib/realtime-webrtc";

describe("настоящая пауза Realtime-поединка", () => {
  it("отключает VAD и очищает вход, когда оппонент ещё не отвечает", () => {
    expect(buildPauseRealtimeEvents({
      responseActive: false,
      opponentPlaybackActive: false,
    })).toEqual([
      {
        type: "session.update",
        session: { type: "realtime", audio: { input: { turn_detection: null } } },
      },
      { type: "input_audio_buffer.clear" },
    ]);
  });

  it("останавливает ответ, очищает звук и синхронизирует услышанную позицию", () => {
    expect(buildPauseRealtimeEvents({
      responseActive: true,
      opponentPlaybackActive: true,
      assistantItemId: "item_123",
      audioEndMs: 1849.9,
    })).toEqual([
      {
        type: "session.update",
        session: { type: "realtime", audio: { input: { turn_detection: null } } },
      },
      { type: "response.cancel" },
      { type: "output_audio_buffer.clear" },
      {
        type: "conversation.item.truncate",
        item_id: "item_123",
        content_index: 0,
        audio_end_ms: 1849,
      },
      { type: "input_audio_buffer.clear" },
    ]);
  });

  it("восстанавливает VAD и просит продолжить прерванную реплику", () => {
    const events = buildResumeRealtimeEvents({
      eagerness: "high",
      continueOpponent: true,
      opponentWasAudible: true,
    });

    expect(events[0]).toMatchObject({
      type: "session.update",
      session: {
        audio: {
          input: {
            turn_detection: {
              type: "semantic_vad",
              eagerness: "high",
              create_response: false,
              interrupt_response: true,
            },
          },
        },
      },
    });
    expect(events[1]).toMatchObject({
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
    expect(JSON.stringify(events[1])).toContain("Продолжи прерванную реплику");
    expect(JSON.stringify(events[1])).toContain("каждую реплику только на русском языке");
  });

  it("передаёт эмоциональную режиссуру только в следующий аудиоответ", () => {
    const sent: string[] = [];
    const channel = {
      readyState: "open",
      send: (payload: string) => sent.push(payload),
    } as unknown as RTCDataChannel;

    expect(requestRealtimeResponse(channel, "Говори сдержанно и холоднее.")).toBe(true);
    expect(JSON.parse(sent[0])).toEqual({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: expect.stringContaining("Говори сдержанно и холоднее."),
      },
    });
    expect(JSON.parse(sent[0]).response.instructions).toContain("каждую реплику только на русском языке");
  });

  it("добавляет русский контракт даже к ответу без локальной режиссуры", () => {
    expect(buildRealtimeResponseEvent()).toMatchObject({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: expect.stringContaining("Первая реплика оппонента обязательно должна быть на русском языке"),
      },
    });
  });
});
