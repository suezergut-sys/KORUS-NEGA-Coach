export const STANDARD_DAILY_TRAINING_LIMIT = 3;
export const PREMIUM_DAILY_TRAINING_LIMIT = 20;

export type TrainingTier = "standard" | "premium";

export type TrainingQuota = {
  tier: TrainingTier;
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type DailyTrainingQuotaRow = {
  training_tier?: unknown;
  daily_limit?: unknown;
  used_today?: unknown;
  remaining_today?: unknown;
};

export const TRAINING_LIMIT_CONTACT_URL = "https://t.me/SueZergut";

export function normalizeTrainingTier(value: unknown): TrainingTier {
  return value === "premium" ? "premium" : "standard";
}

export function mapDailyTrainingQuota(row: DailyTrainingQuotaRow | null | undefined, administrator = false): TrainingQuota {
  const used = Math.max(0, Number(row?.used_today) || 0);
  if (administrator || row?.daily_limit === null) {
    return { tier: normalizeTrainingTier(row?.training_tier), limit: null, used, remaining: null };
  }
  const limit = Math.max(0, Number(row?.daily_limit) || STANDARD_DAILY_TRAINING_LIMIT);
  const remaining = Math.max(0, Math.min(limit, Number(row?.remaining_today) || 0));
  return { tier: normalizeTrainingTier(row?.training_tier), limit, used, remaining };
}

export function formatTrainingQuota(quota: TrainingQuota) {
  return quota.limit === null || quota.remaining === null ? "∞" : `${quota.remaining}/${quota.limit}`;
}

export function isTrainingQuotaExhausted(quota: TrainingQuota) {
  return quota.limit !== null && quota.remaining === 0;
}
