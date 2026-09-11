import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CASE } from "../src/lib/default-case";
const mocks = vi.hoisted(() => ({ user: vi.fn(), claim: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/user-auth", () => ({ getCurrentUserSession: mocks.user }));
vi.mock("@/lib/case-resolver", () => ({
  resolvePublishedCase: async () => DEFAULT_CASE,
  resolvePublishedCaseForAdmin: async () => DEFAULT_CASE,
  selectCaseRoles: () => ({ participantRole: DEFAULT_CASE.userRole, opponentRole: DEFAULT_CASE.opponentRole, negotiationReason: DEFAULT_CASE.conflict }),
}));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { case_id: null, case_code: DEFAULT_CASE.slug, participant_role_name: DEFAULT_CASE.userRole.name, opponent_name: DEFAULT_CASE.opponentRole.name } }) };
  return { from: () => query, rpc: mocks.claim };
} }));
import { POST } from "../src/app/api/live/session/route";

function request() { return new Request("http://localhost/api/live/session?sessionId=11111111-1111-4111-8111-111111111111", { method: "POST", body: "v=0\r\n" }); }
describe("Live session authorization and transport", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.user.mockResolvedValue({ userId: "test-user" });
    mocks.claim.mockResolvedValue({ data: true });
    mocks.fetch.mockReset().mockResolvedValue(Response.json({ session: { id: "live-test" }, transport: { sdp: "v=0\r\nanswer" } }));
  });
  it("rejects anonymous and already consumed training sessions before any paid call", async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.claim.mockResolvedValueOnce({ data: false });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("claims the session and exchanges JSON for an SDP-only response", async () => {
    const response = await POST(request());
    expect(await response.text()).toBe("v=0\r\nanswer");
    expect(mocks.claim).toHaveBeenCalledWith("claim_training_realtime", expect.any(Object));
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/live/sessions");
    const body = JSON.parse(init.body);
    expect(body.session.model).toBe("gpt-live-1");
    expect(body.transport).toEqual({ type: "webrtc", sdp: "v=0\r\n" });
    expect(body.session.delegation.responses.instructions).toContain(DEFAULT_CASE.title);
  });
});
