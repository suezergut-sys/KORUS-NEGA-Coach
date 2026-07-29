export type CaseVisibility = "public" | "private";

export function parseCaseVisibility(value: unknown): CaseVisibility | null {
  return value === "public" || value === "private" ? value : null;
}

export function canAccessCase(
  item: { visibility?: unknown; owner_user_id?: unknown },
  userId: string | null | undefined,
) {
  const visibility = parseCaseVisibility(item.visibility) || "public";
  return visibility === "public" || (Boolean(userId) && item.owner_user_id === userId);
}
