import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("training quota contracts", () => {
  const migration = readFileSync("supabase/migrations/20260819223000_daily_training_quotas.sql", "utf8");

  it("enforces atomic Moscow-day limits before creating a session", () => {
    expect(migration).toContain("when v_tier = 'premium' then 20");
    expect(migration).toContain("else 3");
    expect(migration).toContain("timezone('Europe/Moscow'");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration.indexOf("pg_advisory_xact_lock")).toBeLessThan(migration.indexOf("insert into public.training_sessions"));
    expect(migration).toMatch(/if v_limit is not null and v_used >= v_limit then[\s\S]+null::uuid/);
  });

  it("allows only one paid Realtime call per counted training session", () => {
    expect(migration).toContain("create or replace function public.claim_training_realtime");
    expect(migration).toContain("and realtime_started_at is null");
    expect(migration).toContain("revoke all on function public.claim_training_realtime(uuid, uuid) from public, anon, authenticated");

    const route = readFileSync("src/app/api/realtime/session/route.ts", "utf8");
    expect(route).toContain('rpc("claim_training_realtime"');
    expect(route.indexOf('rpc("claim_training_realtime"')).toBeLessThan(route.indexOf('fetch("https://api.openai.com/v1/realtime/calls"'));
  });

  it("shows quota status in the requested user surfaces", () => {
    const arena = readFileSync("src/components/VoiceArena.tsx", "utf8");
    const welcome = readFileSync("src/components/WelcomeBackModal.tsx", "utf8");
    const users = readFileSync("src/app/admin/(protected)/users/page.tsx", "utf8");
    expect(arena).toContain("НАЧАТЬ · ${formatTrainingQuota(trainingQuota)}");
    expect(arena).toContain("quota-exhausted");
    expect(arena).toContain("Максиму Сумину");
    expect(arena).toContain("TRAINING_LIMIT_CONTACT_URL");
    expect(welcome).toContain("Доступно тренировок сегодня");
    expect(users).toContain("<th>Статус</th>");
    expect(users).toContain("AdminUserTrainingTierSelect");
  });
});
