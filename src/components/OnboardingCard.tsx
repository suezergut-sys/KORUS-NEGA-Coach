import AppBrandMark from "./AppBrandMark";
import AppSectionIcon from "./AppSectionIcon";
import type { OnboardingStep } from "../lib/onboarding";

type OnboardingCardProps = {
  step: OnboardingStep;
  currentIndex: number;
  total: number;
};

function StepVisual({ step }: { step: OnboardingStep }) {
  if (step.kind === "welcome") {
    return (
      <div className="onboarding-welcome-symbol">
        <AppBrandMark className="onboarding-brand-mark" priority />
        <span className="onboarding-dialog-symbol" aria-hidden="true">
          <AppSectionIcon name="negotiations" />
        </span>
        <strong>KORUS NEGA AI</strong>
        <small>ТРЕНАЖЁР ПЕРЕГОВОРОВ</small>
      </div>
    );
  }

  const icons = step.kind === "overview"
    ? step.capabilities?.map((capability) => capability.icon) ?? []
    : step.icons;

  return (
    <div className={`onboarding-section-symbol onboarding-section-symbol-${step.id}`} aria-hidden="true">
      <span className="onboarding-symbol-orbit" />
      <div className="onboarding-icon-stack">
        {icons.map((icon, index) => (
          <span className="onboarding-section-icon" key={`${icon}-${index}`}>
            <AppSectionIcon name={icon} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Progress({ currentIndex, total }: { currentIndex: number; total: number }) {
  return (
    <div className="onboarding-progress" aria-label={`Экран ${currentIndex + 1} из ${total}`}>
      {Array.from({ length: total }, (_, index) => {
        const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        return <span className="onboarding-progress-segment" data-state={state} aria-hidden="true" key={index} />;
      })}
    </div>
  );
}

export default function OnboardingCard({ step, currentIndex, total }: OnboardingCardProps) {
  return (
    <div className={`onboarding-card onboarding-card-${step.kind}`}>
      <div className="onboarding-card-visual">
        <StepVisual step={step} />
      </div>
      <div className="onboarding-card-copy">
        <span className="onboarding-eyebrow">{step.eyebrow}</span>
        <h2 id="onboarding-title">{step.title}</h2>
        <p id="onboarding-description">{step.description}</p>

        {step.highlights && (
          <ul className="onboarding-highlight-list">
            {step.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        )}

        {step.capabilities && (
          <div className="onboarding-capability-grid">
            {step.capabilities.map((capability) => (
              <section className="onboarding-capability" key={capability.title}>
                <span aria-hidden="true"><AppSectionIcon name={capability.icon} /></span>
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </div>
              </section>
            ))}
          </div>
        )}

        {step.why && (
          <section className="onboarding-why">
            <h3>Зачем тебе это</h3>
            <p>{step.why}</p>
          </section>
        )}

        {step.actions && (
          <section className={step.kind === "final" ? "onboarding-how onboarding-final-route" : "onboarding-how"}>
            <h3>{step.kind === "final" ? "Твой маршрут" : "Что делать"}</h3>
            <ol>
              {step.actions.map((action) => <li key={action}>{action}</li>)}
            </ol>
          </section>
        )}

        {step.footer && <p className="onboarding-card-footer">{step.footer}</p>}
      </div>
      <Progress currentIndex={currentIndex} total={total} />
    </div>
  );
}
