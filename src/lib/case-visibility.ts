export type CaseVisibility = "public" | "private";
export type StoredCaseVisibility = CaseVisibility | "department";

export type CaseAccessContext = {
  userId?: string | null;
  departmentId?: string | null;
  isAdministrator?: boolean;
};

export function parseCaseVisibility(value: unknown): CaseVisibility | null {
  return value === "public" || value === "private" ? value : null;
}

function parseStoredCaseVisibility(value: unknown): StoredCaseVisibility | null {
  return value === "department" ? value : parseCaseVisibility(value);
}

export function canAccessCase(
  item: { visibility?: unknown; owner_user_id?: unknown; department_id?: unknown; departmentId?: unknown },
  context: string | null | undefined | CaseAccessContext,
) {
  const visibility = parseStoredCaseVisibility(item.visibility) || "public";
  const access = typeof context === "object" && context !== null ? context : { userId: context };
  if (visibility === "public") return true;
  if (visibility === "private") return Boolean(access.userId) && item.owner_user_id === access.userId;
  if (access.isAdministrator) return true;
  const caseDepartmentId = item.department_id || item.departmentId;
  return Boolean(access.departmentId) && caseDepartmentId === access.departmentId;
}
