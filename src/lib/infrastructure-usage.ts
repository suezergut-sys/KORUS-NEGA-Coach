import { getSupabaseAdmin } from "@/lib/supabase-server";

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export type InfrastructureMetric = {
  id: string;
  label: string;
  used: number | null;
  limit: number;
  unit: "bytes" | "count" | "seconds" | "gb-hours";
  note: string;
};

export type InfrastructureProvider = {
  id: "supabase" | "vercel";
  name: string;
  plan: string;
  dashboardUrl: string;
  updatedAt: string;
  status: "live" | "partial" | "unavailable";
  message?: string;
  metrics: InfrastructureMetric[];
};

type SupabaseUsageRow = {
  database_bytes: number | string;
  storage_bytes: number | string;
  auth_users: number | string;
};

type FocusCharge = Record<string, unknown>;

const hobbyMetrics = (): InfrastructureMetric[] => [
  { id: "vercel-invocations", label: "Вызовы функций", used: null, limit: 1_000_000, unit: "count", note: "за месяц" },
  { id: "vercel-cpu", label: "Активное CPU", used: null, limit: 4 * 60 * 60, unit: "seconds", note: "за месяц" },
  { id: "vercel-memory", label: "Память функций", used: null, limit: 360, unit: "gb-hours", note: "за месяц" },
  { id: "vercel-transfer", label: "Передача данных", used: null, limit: 100 * GB, unit: "bytes", note: "за месяц" },
];

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chargeText(charge: FocusCharge) {
  return Object.entries(charge)
    .filter(([key]) => /service|sku|description|unit/i.test(key))
    .map(([, value]) => String(value))
    .join(" ")
    .toLowerCase();
}

function chargeQuantity(charge: FocusCharge) {
  return numberValue(charge.ConsumedQuantity ?? charge.consumedQuantity ?? charge.quantity);
}

function populateVercelUsage(metrics: InfrastructureMetric[], charges: FocusCharge[]) {
  for (const charge of charges) {
    const text = chargeText(charge);
    const quantity = chargeQuantity(charge);
    const add = (id: string, multiplier = 1) => {
      const metric = metrics.find((item) => item.id === id);
      if (metric) metric.used = (metric.used || 0) + quantity * multiplier;
    };

    if (/function.*invocation|invocation.*function/.test(text)) add("vercel-invocations");
    else if (/active.*cpu|cpu.*active/.test(text)) add("vercel-cpu", /hour/.test(text) ? 3600 : 1);
    else if (/provisioned.*memory|memory.*provisioned/.test(text)) add("vercel-memory");
    else if (/fast.*data.*transfer|data.*transfer/.test(text)) add("vercel-transfer", /gb|gigabyte/.test(text) ? GB : 1);
  }
  return metrics;
}

function parseJsonLines(body: string): FocusCharge[] {
  return body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });
}

async function getVercelUsage(): Promise<InfrastructureProvider> {
  const metrics = hobbyMetrics();
  const token = process.env.VERCEL_ACCESS_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const now = new Date();
  if (!token || !teamId) {
    return {
      id: "vercel", name: "Vercel", plan: "Hobby", status: "unavailable", metrics,
      dashboardUrl: "https://vercel.com/dashboard/usage", updatedAt: now.toISOString(),
      message: "Vercel Hobby не отдаёт потребление квот через официальный API. Значения доступны на странице Usage в Vercel.",
    };
  }

  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("teamId", teamId);
  url.searchParams.set("from", from.toISOString());
  url.searchParams.set("to", to.toISOString());
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/x-ndjson" }, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const populated = populateVercelUsage(metrics, parseJsonLines(await response.text()));
    const known = populated.filter((metric) => metric.used !== null).length;
    return {
      id: "vercel", name: "Vercel", plan: "Hobby", metrics: populated,
      status: known === populated.length ? "live" : "partial",
      dashboardUrl: "https://vercel.com/dashboard/usage", updatedAt: now.toISOString(),
      message: known ? "Показатели получены из Vercel Billing API с начала текущего месяца." : "API ответил, но не вернул распознаваемые показатели квот.",
    };
  } catch {
    return {
      id: "vercel", name: "Vercel", plan: "Hobby", status: "unavailable", metrics,
      dashboardUrl: "https://vercel.com/dashboard/usage", updatedAt: now.toISOString(),
      message: "Vercel не предоставил данные Usage. На Hobby официальный Billing API недоступен; используйте ссылку на кабинет.",
    };
  }
}

async function getSupabaseUsage(): Promise<InfrastructureProvider> {
  const now = new Date();
  const metrics: InfrastructureMetric[] = [
    { id: "supabase-db", label: "База данных", used: null, limit: 500 * MB, unit: "bytes", note: "жёсткий лимит Free" },
    { id: "supabase-storage", label: "Файлы Storage", used: null, limit: GB, unit: "bytes", note: "все бакеты" },
    { id: "supabase-users", label: "Пользователи Auth", used: null, limit: 50_000, unit: "count", note: "зарегистрировано; лимит тарифа считается по MAU" },
    { id: "supabase-egress", label: "Исходящий трафик", used: null, limit: 5 * GB, unit: "bytes", note: "за месяц, без кэшированного трафика" },
  ];
  try {
    const { data, error } = await getSupabaseAdmin().rpc("admin_infrastructure_usage").single();
    if (error) throw error;
    const row = data as SupabaseUsageRow;
    metrics[0].used = numberValue(row.database_bytes);
    metrics[1].used = numberValue(row.storage_bytes);
    metrics[2].used = numberValue(row.auth_users);
    return {
      id: "supabase", name: "Supabase", plan: "Free", status: "partial", metrics,
      dashboardUrl: "https://supabase.com/dashboard/org/_/usage", updatedAt: now.toISOString(),
      message: "Размер базы, Storage и число аккаунтов получены в реальном времени. Месячный трафик Supabase не предоставляет через публичный API.",
    };
  } catch {
    return {
      id: "supabase", name: "Supabase", plan: "Free", status: "unavailable", metrics,
      dashboardUrl: "https://supabase.com/dashboard/org/_/usage", updatedAt: now.toISOString(),
      message: "Не удалось получить метрики. Проверьте применение последней миграции Supabase.",
    };
  }
}

export async function getInfrastructureUsage() {
  return Promise.all([getSupabaseUsage(), getVercelUsage()]);
}

