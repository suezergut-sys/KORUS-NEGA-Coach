import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/user-auth", () => ({
  getCurrentUserSession: vi.fn(async () => ({
    userId: "11111111-1111-4111-8111-111111111111",
  })),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin: () => {
    const lookup = {
      eq: () => lookup,
      maybeSingle: async () => ({
        data: { id: "22222222-2222-4222-8222-222222222222", is_ranked: true, status: "completed" },
        error: null,
      }),
    };
    return {
      from: () => ({ select: () => lookup }),
      rpc,
    };
  },
}));

vi.mock("@/lib/user-activity-monitoring", () => ({
  recordUserActivity: vi.fn(async () => undefined),
}));

describe("session speech analytics API integration", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "22222222-2222-4222-8222-222222222222", error: null });
  });

  it("calculates and persists duplex analytics during atomic finalization", async () => {
    const { PATCH } = await import("../../src/app/api/sessions/[id]/route");
    const response = await PATCH(new Request("http://localhost/api/sessions/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationSeconds: 60,
        turns: [
          { id: "1", author: "Вы", text: "Почему вы не согласовали срок?", time: "10:00" },
          { id: "2", author: "Оппонент", text: "Не хватило ресурсов.", time: "10:01" },
        ],
        metrics: {
          inputMode: "duplex",
          userSpeakingDurationsMs: [4_000],
          opponentSpeakingDurationsMs: [6_000],
          userResponseTimesMs: [1_500],
          opponentTimingSource: "output_audio_buffer",
          interruptionCount: 1,
        },
      }),
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "analysis_pending",
      metrics: {
        speechAnalytics: {
          inputMode: "duplex",
          talkSharePercent: 40,
          responseTimeP50Ms: 1_500,
          questionCount: 1,
          fillerPercent: 0,
          timingVersion: 3,
          timingAvailable: true,
          interruptionCount: 1,
        },
      },
    });
    expect(rpc).toHaveBeenCalledWith("finalize_training_session", expect.objectContaining({
      p_metric_details: expect.objectContaining({
        inputMode: "duplex",
        speechAnalytics: expect.objectContaining({ talkSharePercent: 40 }),
        speechTiming: {
          version: 3,
          opponentTimingSource: "output_audio_buffer",
          userSpeakingDurationsMs: [4_000],
          opponentSpeakingDurationsMs: [6_000],
          userResponseTimesMs: [1_500],
        },
      }),
    }));
  });
});
