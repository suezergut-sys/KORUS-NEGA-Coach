"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import OnboardingCard from "@/components/OnboardingCard";
import {
  ONBOARDING_STEPS,
  clampOnboardingStep,
  getOnboardingFocusWrapTarget,
  getOnboardingStorage,
  readOnboardingCompleted,
  shouldAutoOpenOnboarding,
  writeOnboardingCompleted,
} from "@/lib/onboarding";

export const ONBOARDING_OPEN_EVENT = "nega:onboarding:open";

export default function OnboardingModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const completeAndClose = useCallback(() => {
    writeOnboardingCompleted(getOnboardingStorage(window));
    setOpen(false);
  }, []);

  const finish = useCallback(() => {
    completeAndClose();
    router.push("/");
  }, [completeAndClose, router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedAfterRegistration = url.searchParams.get("onboarding") === "1";
    const completed = readOnboardingCompleted(getOnboardingStorage(window));
    const shouldAutoOpen = shouldAutoOpenOnboarding({
      pathname: url.pathname,
      requested: requestedAfterRegistration,
      completed,
    });

    if (requestedAfterRegistration) {
      url.searchParams.delete("onboarding");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const initialOpenTimer = shouldAutoOpen ? window.setTimeout(show, 0) : undefined;
    window.addEventListener(ONBOARDING_OPEN_EVENT, show);

    return () => {
      if (initialOpenTimer !== undefined) window.clearTimeout(initialOpenTimer);
      window.removeEventListener(ONBOARDING_OPEN_EVENT, show);
    };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        completeAndClose();
        return;
      }
      if (event.key === "ArrowRight") {
        setStep((current) => clampOnboardingStep(current + 1, ONBOARDING_STEPS.length));
        return;
      }
      if (event.key === "ArrowLeft") {
        setStep((current) => clampOnboardingStep(current - 1, ONBOARDING_STEPS.length));
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const target = getOnboardingFocusWrapTarget<HTMLElement>({
        active: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        container: dialogRef.current,
        first,
        last,
        shiftKey: event.shiftKey,
      });

      if (target) {
        event.preventDefault();
        target.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [completeAndClose, open]);

  if (!open) return null;

  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div className="onboarding-overlay" role="presentation">
      <div
        className="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        ref={dialogRef}
        tabIndex={-1}
      >
        <button className="onboarding-skip" type="button" onClick={completeAndClose}>Пропустить</button>
        <OnboardingCard step={current} currentIndex={step} total={ONBOARDING_STEPS.length} />
        <footer className="onboarding-actions">
          <button
            className="onboarding-back"
            type="button"
            onClick={() => setStep((currentStep) => clampOnboardingStep(currentStep - 1, ONBOARDING_STEPS.length))}
            disabled={step === 0}
          >
            Назад
          </button>
          <button
            className="onboarding-next"
            type="button"
            onClick={isLast ? finish : () => setStep((currentStep) => clampOnboardingStep(currentStep + 1, ONBOARDING_STEPS.length))}
          >
            {isLast ? "Перейти к переговорам" : "Далее"} <b aria-hidden="true">{isLast ? "✓" : "→"}</b>
          </button>
        </footer>
      </div>
    </div>
  );
}
