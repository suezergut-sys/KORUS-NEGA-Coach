import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppBrandMark from "../src/components/AppBrandMark";
import AppSectionIcon, { APP_SECTION_ICON_NAMES } from "../src/components/AppSectionIcon";
import CaseBuilder from "../src/components/CaseBuilder";

describe("shared application visuals", () => {
  it("renders the canonical KORUS logo source", () => {
    const markup = renderToStaticMarkup(<AppBrandMark />);
    expect(markup).toContain("korus_sign_color.jpg");
    expect(markup).toContain("KORUS Consulting");
  });

  it("exports every icon used by navigation and onboarding", () => {
    expect(APP_SECTION_ICON_NAMES).toEqual([
      "negotiations",
      "account",
      "rating",
      "cases",
      "upload",
      "create",
      "analyze",
      "feedback",
      "about",
      "logout",
      "admin",
      "mobile",
    ]);
    for (const name of APP_SECTION_ICON_NAMES) {
      expect(renderToStaticMarkup(<AppSectionIcon name={name} />)).toContain("<svg");
    }
  });

  it("offers voice input for the case description", () => {
    const markup = renderToStaticMarkup(<CaseBuilder />);
    expect(markup).toContain('aria-label="Начать голосовой ввод"');
    expect(markup).toContain("ГОЛОСОВОЙ ВВОД");
    expect(markup).toContain("builder-notes-mic");
    expect(markup).toContain("уточнять текстом или голосом до одобрения");
  });
});
