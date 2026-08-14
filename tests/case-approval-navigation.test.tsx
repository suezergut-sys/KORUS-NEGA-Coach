import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CaseAddedNotice from "../src/components/CaseAddedNotice";
import {
  CASE_ADDED_MESSAGE,
  caseApprovalRedirectUrl,
  consumeCaseAddedNotice,
} from "../src/lib/case-approval-navigation";

describe("case approval navigation", () => {
  it("opens Negotiations with the approved case and a one-time notice", () => {
    expect(caseApprovalRedirectUrl("new-case-id")).toBe("/?case=new-case-id&caseAdded=1");
  });

  it("consumes only the notice flag and preserves the selected case", () => {
    const result = consumeCaseAddedNotice(new URL("https://example.test/?case=new-case-id&caseAdded=1"));
    expect(result).toEqual({ shouldShow: true, cleanUrl: "/?case=new-case-id" });
  });

  it("renders the exact success message as an accessible status", () => {
    const markup = renderToStaticMarkup(<CaseAddedNotice onDismiss={() => undefined} />);
    expect(CASE_ADDED_MESSAGE).toBe("Спасибо! Кейс добавлен в базу.");
    expect(markup).toContain('role="status"');
    expect(markup).toContain(CASE_ADDED_MESSAGE);
  });
});
