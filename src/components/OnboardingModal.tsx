"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ONBOARDING_OPEN_EVENT = "nega:onboarding:open";

const ONBOARDING_STORAGE_KEY = "korus-nega-onboarding-v1";

const steps = [
  {
    eyebrow: "ДОБРО ПОЖАЛОВАТЬ",
    title: "Освойтесь в KORUS NEGA AI",
    description: "Коротко покажем, где находятся основные инструменты и как провести первую тренировку. Это займёт меньше минуты.",
  },
  {
    eyebrow: "НАВИГАЦИЯ",
    title: "Все разделы всегда под рукой",
    description: "Используйте панель слева: возвращайтесь к переговорам, следите за прогрессом в личном кабинете, сравнивайте результаты и работайте со своими кейсами.",
  },
  {
    eyebrow: "НАСТРОЙКА",
    title: "Подготовьте сценарий переговоров",
    description: "На главном экране выберите кейс и свою роль. Затем настройте методику, стиль оппонента, длительность разговора и режим микрофона.",
  },
  {
    eyebrow: "ПЕРВАЯ ТРЕНИРОВКА",
    title: "Запустите переговоры",
    description: "Ознакомьтесь с ситуацией, разрешите доступ к микрофону и нажмите «Начать». После разговора вы получите разбор, рекомендации и результат в личном кабинете.",
  },
] as const;

function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="onboarding-welcome-visual" aria-hidden="true">
        <span className="onboarding-orbit orbit-one" />
        <span className="onboarding-orbit orbit-two" />
        <div className="onboarding-brand-mark">N</div>
        <span className="onboarding-pulse pulse-one" />
        <span className="onboarding-pulse pulse-two" />
        <span className="onboarding-pulse pulse-three" />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="onboarding-nav-visual" aria-label="Схема разделов приложения">
        <div className="onboarding-mini-rail" aria-hidden="true">
          <b>K</b><i className="active">◫</i><i>♙</i><i>▥</i><i>↑</i><i>＋</i>
        </div>
        <div className="onboarding-section-list">
          <div><span>01</span><p><strong>Переговоры</strong><small>Тренировки с AI-оппонентом</small></p></div>
          <div><span>02</span><p><strong>Личный кабинет</strong><small>Прогресс и история поединков</small></p></div>
          <div><span>03</span><p><strong>Кейсы и анализ</strong><small>Загрузка, создание и разбор</small></p></div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="onboarding-setup-visual" aria-label="Этапы настройки переговоров">
        {[
          ["1", "Кейс", "Выберите ситуацию"],
          ["2", "Роль", "Определите сторону"],
          ["3", "Формат", "Стиль, время, микрофон"],
        ].map(([number, title, copy]) => (
          <div key={number}>
            <span>{number}</span>
            <p><strong>{title}</strong><small>{copy}</small></p>
            {number !== "3" && <b aria-hidden="true">›</b>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="onboarding-launch-visual" aria-label="Схема запуска тренировки">
      <div className="onboarding-wave" aria-hidden="true">
        {[28, 52, 72, 42, 86, 60, 34, 68, 48, 78, 38, 58].map((height, index) => <i key={index} style={{ height }} />)}
      </div>
      <div className="onboarding-launch-flow">
        <span><b>1</b> Откройте ситуацию</span>
        <span><b>2</b> Разрешите микрофон</span>
        <span className="active"><b>3</b> Нажмите «Начать»</span>
      </div>
    </div>
  );
}

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "completed");
    setOpen(false);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedAfterRegistration = url.searchParams.get("onboarding") === "1";
    const pending = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "pending";

    if (requestedAfterRegistration) {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "pending");
      url.searchParams.delete("onboarding");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const initialOpenTimer = requestedAfterRegistration || pending ? window.setTimeout(show, 0) : undefined;

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
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setStep((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setStep((current) => Math.max(current - 1, 0));
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  if (!open) return null;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="onboarding-overlay" role="presentation">
      <div className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" ref={dialogRef} tabIndex={-1}>
        <button className="onboarding-skip" type="button" onClick={close}>Пропустить</button>
        <div className="onboarding-visual">
          <StepVisual step={step} />
        </div>
        <div className="onboarding-content">
          <span className="onboarding-eyebrow">{current.eyebrow}</span>
          <h2 id="onboarding-title">{current.title}</h2>
          <p id="onboarding-description">{current.description}</p>
          <div className="onboarding-progress" aria-label={`Шаг ${step + 1} из ${steps.length}`}>
            {steps.map((item, index) => (
              <button key={item.title} type="button" className={index === step ? "active" : ""} onClick={() => setStep(index)} aria-label={`Перейти к шагу ${index + 1}`} aria-current={index === step ? "step" : undefined} />
            ))}
          </div>
          <footer className="onboarding-actions">
            <button className="onboarding-back" type="button" onClick={() => setStep((currentStep) => currentStep - 1)} disabled={step === 0}>Назад</button>
            <span>{step + 1} / {steps.length}</span>
            <button className="onboarding-next" type="button" onClick={isLast ? close : () => setStep((currentStep) => currentStep + 1)}>
              {isLast ? "Начать работу" : "Далее"} <b aria-hidden="true">{isLast ? "✓" : "→"}</b>
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
