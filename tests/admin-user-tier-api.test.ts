import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAdminAuthenticated: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: mocks.isAdminAuthenticated }));
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: (value: unknown) => {
        mocks.update(value);
        const chain = {
          eq: () => chain,
          select: () => chain,
          maybeSingle: async () => ({ data: { id: "22222222-2222-4222-8222-222222222222", training_tier: "premium" }, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

describe("administrator user training tier API", () => {
  beforeEach(() => {
    mocks.isAdminAuthenticated.mockReset();
    mocks.update.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.isAdminAuthenticated.mockResolvedValue(true);
  });

  it("rejects non-administrators and cross-origin writes", async () => {
    const { PATCH } = await import("../src/app/api/admin/users/[id]/route");
    mocks.isAdminAuthenticated.mockResolvedValueOnce(false);
    const denied = await PATCH(new Request("https://example.test/api/admin/users/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      body: JSON.stringify({ trainingTier: "premium" }),
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });
    expect(denied.status).toBe(403);

    const crossOrigin = await PATCH(new Request("https://example.test/api/admin/users/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { origin: "https://evil.test", "Content-Type": "application/json" },
      body: JSON.stringify({ trainingTier: "premium" }),
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });
    expect(crossOrigin.status).toBe(403);
  });

  it("validates and persists the premium status", async () => {
    const { PATCH } = await import("../src/app/api/admin/users/[id]/route");
    const invalid = await PATCH(new Request("https://example.test/api/admin/users/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingTier: "vip" }),
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });
    expect(invalid.status).toBe(400);

    const saved = await PATCH(new Request("https://example.test/api/admin/users/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingTier: "premium" }),
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });
    expect(saved.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ training_tier: "premium" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("clears a user's department without changing the training tier", async () => {
    const { PATCH } = await import("../src/app/api/admin/users/[id]/route");
    const response = await PATCH(new Request("https://example.test/api/admin/users/22222222-2222-4222-8222-222222222222", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId: null }),
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ department_id: null }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ training_tier: expect.anything() }));
  });
});
