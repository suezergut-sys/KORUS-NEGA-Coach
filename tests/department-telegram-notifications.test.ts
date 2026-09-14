import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { recordUserActivity } from "../src/lib/user-activity-monitoring";

const mocks = vi.hoisted(() => ({ from: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
vi.mock("@/lib/telegram", () => ({ sendTelegramMessage: mocks.send }));

function setup({ departmentId = "dept-1c", code = "1c", duplicate = false, departmentError = false }:
  { departmentId?: string | null; code?: string; duplicate?: boolean; departmentError?: boolean } = {}) {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  mocks.from.mockImplementation((table: string) => {
    if (table === "user_profiles") return { select: () => ({ eq: () => ({ single: async () => ({ data: { first_name: "Тест", last_name: "Участник", department_id: departmentId }, error: null }) }) }) };
    if (table === "departments") return { select: () => ({ eq: (field: string, value: string) => {
      expect([field, value]).toEqual(["id", departmentId]);
      return { single: async () => ({ data: departmentError ? null : { code }, error: departmentError ? { message: "lookup failed" } : null }) };
    } }) };
    if (table === "user_activity_events") return {
      insert: () => ({ select: () => ({ single: async () => ({ data: duplicate ? null : { id: "event" }, error: duplicate ? { code: "23505" } : null }) }) }), update,
    };
    throw new Error(`Unexpected table ${table}`);
  });
  return update;
}
const input = { userId: "user", type: "case_played" as const, entityId: "session", subjectTitle: "Любой кейс" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TELEGRAM_MONITOR_USER_CHAT_ID", "main-chat");
  vi.stubEnv("TELEGRAM_1C_MONITOR_CHAT_ID", "department-chat");
  mocks.send.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("department Telegram notifications", () => {
  it("copies completed cases of 1C employees to the department recipient", async () => {
    const update = setup();
    await recordUserActivity(input);
    expect(mocks.send.mock.calls).toEqual([
      ["main-chat", "Тест Участник — отыграл(а) кейс «Любой кейс»."],
      ["department-chat", "Тест Участник — отыграл(а) кейс «Любой кейс»."],
    ]);
    expect(update).toHaveBeenCalledOnce();
  });
  it.each(["elm", "other"])("does not share cases from department %s", async (code) => {
    setup({ code }); await recordUserActivity(input); expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("does not share cases of users without a department", async () => {
    setup({ departmentId: null }); await recordUserActivity(input); expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalledWith("departments");
  });
  it.each(["case_created", "case_uploaded", "user_registered", "user_logged_in", "feedback_submitted", "duel_analyzed"] as const)("keeps %s notifications with the main recipient only", async (type) => {
    setup(); await recordUserActivity({ ...input, type }); expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalledWith("departments");
  });
  it.each(["", "main-chat"])("avoids a duplicate or unconfigured department recipient (%s)", async (chat) => {
    vi.stubEnv("TELEGRAM_1C_MONITOR_CHAT_ID", chat);
    setup(); await recordUserActivity(input); expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("does not resend a previously recorded event", async () => {
    setup({ duplicate: true }); await recordUserActivity(input); expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each(["main-chat", "department-chat"])("still attempts both deliveries when %s fails", async (failedChat) => {
    const update = setup();
    mocks.send.mockImplementation(async (chat: string) => { if (chat === failedChat) throw new Error("delivery failed"); });
    await expect(recordUserActivity(input)).resolves.toBeUndefined();
    expect(mocks.send).toHaveBeenCalledTimes(2); expect(update).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
  it("preserves the main delivery when the department lookup fails", async () => {
    const update = setup({ departmentError: true });
    await recordUserActivity(input);
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith("main-chat", expect.any(String));
    expect(update).not.toHaveBeenCalled();
  });
});
