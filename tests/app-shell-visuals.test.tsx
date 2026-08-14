import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppBrandMark from "../src/components/AppBrandMark";
import AppSectionIcon, { APP_SECTION_ICON_NAMES } from "../src/components/AppSectionIcon";
import CaseBuilder, { CaseVariantRoles } from "../src/components/CaseBuilder";
import CaseNegotiationPairs from "../src/components/CaseNegotiationPairs";
import { DEFAULT_CASE } from "../src/lib/default-case";

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
    expect(markup).toContain("КОЛИЧЕСТВО РОЛЕЙ");
    expect(markup).toContain("3 роли");
  });

  it("shows the context of all three generated roles without hidden motives", () => {
    const thirdRole = {
      ...DEFAULT_CASE.opponentRole,
      name: "Мария Орлова",
      position: "Руководитель службы качества",
      publicGoal: "Защитить критерии качества",
      interests: ["Не допустить рискованного запуска"],
      constraints: ["Нельзя снизить обязательные проверки"],
      hiddenMotives: ["Скрытый тестовый мотив"],
    };
    const markup = renderToStaticMarkup(<CaseVariantRoles roles={[DEFAULT_CASE.userRole, DEFAULT_CASE.opponentRole, thirdRole]} />);
    expect(markup).toContain("РОЛЬ 3");
    expect(markup).toContain("Мария Орлова");
    expect(markup).toContain("Защитить критерии качества");
    expect(markup).toContain("Не допустить рискованного запуска");
    expect(markup).toContain("Нельзя снизить обязательные проверки");
    expect(markup).not.toContain("Скрытый тестовый мотив");
  });

  it("explains which role pairs can negotiate", () => {
    const roles = [DEFAULT_CASE.userRole, DEFAULT_CASE.opponentRole];
    const markup = renderToStaticMarkup(<CaseNegotiationPairs roles={roles} pairs={DEFAULT_CASE.negotiationPairs} />);
    expect(markup).toContain("ВОЗМОЖНЫЕ ПОЕДИНКИ");
    expect(markup).toContain(`${roles[0].name} ↔ ${roles[1].name}`);
    expect(markup).toContain(DEFAULT_CASE.negotiationPairs[0].reason);
  });
});
