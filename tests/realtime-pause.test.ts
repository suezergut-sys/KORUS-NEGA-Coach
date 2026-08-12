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
      type: "conversation.item.create",
      item: {
        role: "system",
        content: [{ type: "input_text", text: expect.stringContaining("Продолжи прерванную реплику") }],
      },
    });
    expect(events[2]).toMatchObject({
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
    expect(events[2]).not.toHaveProperty("response.instructions");
  });

  it("передаёт локальную режиссуру системным сообщением, не заменяя контекст кейса в сессии", () => {
    const sent: string[] = [];
    const channel = {
      readyState: "open",
      send: (payload: string) => sent.push(payload),
    } as unknown as RTCDataChannel;

    expect(requestRealtimeResponse(channel, "Говори сдержанно и холоднее.")).toBe(true);
    expect(JSON.parse(sent[0])).toEqual({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: "Говори сдержанно и холоднее." }],
      },
    });
    expect(JSON.parse(sent[1])).toEqual({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
      },
    });
  });

  it("не переопределяет инструкции сессии при запросе ответа без локальной режиссуры", () => {
    expect(buildRealtimeResponseEvent()).toEqual({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
      },
    });
  });
});
