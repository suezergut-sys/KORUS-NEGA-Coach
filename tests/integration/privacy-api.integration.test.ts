import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/user-auth", () => ({
  getCurrentUserSession: vi.fn(async () => ({ userId: "11111111-1111-1111-1111-111111111111" })),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "training_sessions") {
        return {
          delete: () => ({
            eq: async () => {
              remove();
              return { count: 3, error: null };
            },
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                transcript_consent_at: "2026-07-30T00:00:00.000Z",
                transcript_retention_days: 365,
                data_policy_version: "2026-07-30",
              },
              error: null,
            }),
          }),
        }),
        update: (payload: unknown) => {
          update(payload);
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    transcript_consent_at: "2026-07-30T00:00:00.000Z",
                    transcript_retention_days: 90,
                    data_policy_version: "2026-07-30",
                  },
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    },
  }),
}));

describe("privacy API integration", () => {
  beforeEach(() => {
    update.mockClear();
    remove.mockClear();
  });

  it("reads the current consent contract", async () => {
    const { GET } = await import("../../src/app/api/account/privacy/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ consent: true, retentionDays: 365 });
  });

  it("validates and persists consent with retention", async () => {
    const { PUT } = await import("../../src/app/api/account/privacy/route");
    const response = await PUT(new Request("http://localhost/api/account/privacy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true, retentionDays: 90 }),
    }));
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      transcript_retention_days: 90,
      data_policy_version: "2026-07-30",
    }));
  });

  it("deletes only the authenticated user's training sessions", async () => {
    const { DELETE } = await import("../../src/app/api/account/privacy/route");
    const response = await DELETE();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedSessions: 3 });
    expect(remove).toHaveBeenCalledOnce();
  });
});
