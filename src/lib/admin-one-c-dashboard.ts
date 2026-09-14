export type AdminOneCDashboardRow = {
  id: string;
  first_name: string;
  last_name: string;
  registered_at: string;
  last_login_at: string | null;
  last_case_played_at: string | null;
  played_cases: number;
  average_score: number | string | null;
};

export function formatAdminAverageScore(value: number | string | null) {
  if (value === null) return "—";
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1).replace(".", ",") : "—";
}
