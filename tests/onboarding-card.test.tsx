import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OnboardingCard from "../src/components/OnboardingCard";
import { ONBOARDING_STEPS } from "../src/lib/onboarding";

describe("OnboardingCard", () => {
  it("renders the welcome value proposition and shared brand", () => {
    const markup = renderToStaticMarkup(
      <OnboardingCard step={ONBOARDING_STEPS[0]} currentIndex={0} total={ONBOARDING_STEPS.length} />,
    );
    expect(markup).toContain("Развивай навыки переговоров через практику");
    expect(markup).toContain("korus_sign_color.jpg");
    expect(markup).toContain("аудио не сохраняется, стенограмма — только с твоего согласия");
  });

  it("renders why and action blocks for a feature", () => {
    const markup = renderToStaticMarkup(
      <OnboardingCard step={ONBOARDING_STEPS[2]} currentIndex={2} total={ONBOARDING_STEPS.length} />,
    );
    expect(markup).toContain("Зачем тебе это");
    expect(markup).toContain("Что делать");
    expect(markup).toContain("выбери кейс и изучи вводные");
  });

  it("renders non-interactive progress without visible numbering", () => {
    const markup = renderToStaticMarkup(
      <OnboardingCard step={ONBOARDING_STEPS[3]} currentIndex={3} total={ONBOARDING_STEPS.length} />,
    );
    expect(markup.match(/onboarding-progress-segment/g)).toHaveLength(7);
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("4 / 7");
    expect(markup).toContain("Экран 4 из 7");
  });
});
