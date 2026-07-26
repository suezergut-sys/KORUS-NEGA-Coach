"use client";

import { ONBOARDING_OPEN_EVENT } from "@/components/OnboardingModal";

export default function OnboardingLauncher() {
  return (
    <button className="onboarding-launcher" type="button" onClick={() => window.dispatchEvent(new Event(ONBOARDING_OPEN_EVENT))}>
      <span aria-hidden="true">?</span>
      <div>
        <strong>Как пользоваться сервисом</strong>
        <small>Повторно пройти пошаговое обучение</small>
      </div>
      <b aria-hidden="true">→</b>
    </button>
  );
}
