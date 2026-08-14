export const CASE_ADDED_MESSAGE = "Спасибо! Кейс добавлен в базу.";

export function caseApprovalRedirectUrl(caseId: string) {
  const params = new URLSearchParams({ case: caseId, caseAdded: "1" });
  return `/?${params.toString()}`;
}

export function consumeCaseAddedNotice(url: URL) {
  if (url.searchParams.get("caseAdded") !== "1") {
    return { shouldShow: false, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
  }

  url.searchParams.delete("caseAdded");
  return { shouldShow: true, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}
