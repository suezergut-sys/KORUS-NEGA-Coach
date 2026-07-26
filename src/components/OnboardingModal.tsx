"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ONBOARDING_STORAGE_KEY, shouldAutoOpenOnboarding } from "@/lib/onboarding";

export const ONBOARDING_OPEN_EVENT = "nega:onboarding:open";

type StepIcon = "navigation" | "case" | "settings" | "live" | "account" | "rating" | "create" | "analyze" | "ready";

type OnboardingStep = {
  eyebrow: string;
  title: string;
  description: string;
  icon?: StepIcon;
  points: readonly string[];
};

const steps: readonly OnboardingStep[] = [
  {
    eyebrow: "ДОБРО ПОЖАЛОВАТЬ",
    title: "Познакомьтесь с KORUS NEGA AI",
    description: "Пройдём по всем пользовательским разделам и подготовим вас к первой тренировке. Обучение можно пропустить и в любой момент запустить заново из личного кабинета.",
    points: ["Узнаете, где находятся инструменты", "Настроите переговорный поединок", "Разберётесь с результатами и кейсами"],
  },
  {
    eyebrow: "ШАГ 1 · НАВИГАЦИЯ",
    title: "Перемещайтесь между разделами",
    description: "Компактная панель слева доступна на всех основных страницах. Наведите курсор на значок, чтобы увидеть его название.",
    icon: "navigation",
    points: ["Диалоги — вернуться к тренажёру", "Профиль и диаграмма — кабинет и рейтинг", "Стрелка, плюс и документ — работа с кейсами", "Кнопка выхода — завершить пользовательскую сессию"],
  },
  {
    eyebrow: "ШАГ 2 · ПЕРЕГОВОРЫ",
    title: "Выберите кейс и свою роль",
    description: "Главная страница — рабочее место переговорщика. Сначала задайте ситуацию и сторону, за которую будете играть.",
    icon: "case",
    points: ["Откройте список кейсов и выберите сценарий", "Нажмите «Содержание кейса» и изучите вводные", "Выберите свою роль — AI получит одну из остальных", "Проверьте цели, интересы и ограничения своей стороны"],
  },
  {
    eyebrow: "ШАГ 3 · НАСТРОЙКА",
    title: "Настройте формат тренировки",
    description: "Перед запуском задайте поведение оппонента и удобный способ разговора. Во время активного поединка эти настройки блокируются.",
    icon: "settings",
    points: ["Выберите методику, по которой получите разбор", "Задайте стиль AI-оппонента", "Установите длительность переговоров", "Выберите открытый микрофон или режим «Удерживать, чтобы говорить»"],
  },
  {
    eyebrow: "ШАГ 4 · ПОЕДИНОК",
    title: "Проведите и завершите переговоры",
    description: "Когда всё готово, запускайте голосовой диалог. Реплики появятся в центре экрана, а после завершения система подготовит подробный разбор.",
    icon: "live",
    points: ["Нажмите «Начать» и разрешите доступ к микрофону", "Следите за таймером и расшифровкой реплик", "При необходимости используйте одну паузу и подсказку", "Нажмите «Завершить» и дождитесь анализа результата"],
  },
  {
    eyebrow: "ШАГ 5 · ЛИЧНЫЙ КАБИНЕТ",
    title: "Отслеживайте свой прогресс",
    description: "Личный кабинет собирает только рейтинговые тренировки и помогает увидеть динамику без ручных записей.",
    icon: "account",
    points: ["Смотрите число поединков и процент побед", "Проверяйте дату последней тренировки", "Изучайте три наиболее часто сыгранных кейса", "Открывайте историю с ролью, результатом и баллом"],
  },
  {
    eyebrow: "ШАГ 6 · РЕЙТИНГ",
    title: "Сравнивайте результаты",
    description: "Общий рейтинг показывает показатели участников и помогает понять своё место среди коллег.",
    icon: "rating",
    points: ["Откройте раздел со значком диаграммы", "Сравните поединки, победы и долю побед", "Посмотрите средний балл последних тренировок", "Нажимайте заголовки таблицы для сортировки"],
  },
  {
    eyebrow: "ШАГ 7 · СВОИ КЕЙСЫ",
    title: "Загружайте или создавайте сценарии",
    description: "Для быстрого старта загрузите готовый материал. Если нужен новый сценарий с несколькими вариантами, используйте конструктор.",
    icon: "create",
    points: ["Стрелка вверх — быстрая загрузка готового кейса", "Добавьте файл и дождитесь обработки", "Плюс — конструктор нового кейса из материалов и заметок", "Проверьте вариант и опубликуйте его в библиотеке"],
  },
  {
    eyebrow: "ШАГ 8 · ВНЕШНИЙ АНАЛИЗ",
    title: "Разбирайте проведённые переговоры",
    description: "Раздел с документом и лупой нужен, когда разговор прошёл вне тренажёра, но вы хотите получить методический разбор.",
    icon: "analyze",
    points: ["Загрузите текст кейса", "Добавьте файл с расшифровкой разговора", "Укажите обозначения обоих участников", "Запустите анализ и изучите рекомендации"],
  },
  {
    eyebrow: "ГОТОВО",
    title: "Можно начинать тренировку",
    description: "Вернитесь на главную страницу, выберите кейс и проведите первый поединок. Это обучение всегда доступно в блоке «Помощь» личного кабинета.",
    icon: "ready",
    points: ["Выберите кейс", "Настройте роль и формат", "Нажмите «Начать»", "Изучите итоговый разбор"],
  },
];

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

const visualIcons: Record<StepIcon, ReactNode> = {
  navigation: <Icon><path d="M4 5.5h10v7H8l-4 3v-10Z" /><path d="M10 15.5h6l4 3v-10h-3" /></Icon>,
  case: <Icon><path d="M4 7h16M4 12h11M4 17h8" /><circle cx="18" cy="16" r="3" /></Icon>,
  settings: <Icon><circle cx="12" cy="12" r="3" /><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6 8 8m8 8 2.4 2.4m0-12.8L16 8M8 16l-2.4 2.4" /></Icon>,
  live: <Icon><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></Icon>,
  account: <Icon><circle cx="12" cy="8" r="3" /><path d="M6.5 19c.6-3.2 2.4-5 5.5-5s4.9 1.8 5.5 5" /></Icon>,
  rating: <Icon><path d="M5 19V12h3v7H5Zm5.5 0V8h3v11h-3ZM16 19V4h3v15h-3Z" /></Icon>,
  create: <Icon><path d="M12 5v14M5 12h14" /><path d="M4 4h5M4 20h5M15 4h5M15 20h5" /></Icon>,
  analyze: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16h8" /><path d="M14 2v5h5m-5-5 5 5v4" /><circle cx="15.5" cy="15.5" r="3.5" /><path d="m18 18 3 3" /></Icon>,
  ready: <Icon><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></Icon>,
};

function StepVisual({ step, index }: { step: OnboardingStep; index: number }) {
  if (index === 0) {
    return (
      <div className="onboarding-welcome-visual">
        <span className="onboarding-orbit orbit-one" aria-hidden="true" />
        <span className="onboarding-orbit orbit-two" aria-hidden="true" />
        <div className="onboarding-brand-mark">
          <Image src="/korus_sign_color.jpg" alt="KORUS Consulting" fill sizes="112px" priority />
        </div>
        <strong>KORUS NEGA AI 2.0</strong>
        <small>ТРЕНАЖЁР ПЕРЕГОВОРОВ</small>
        <span className="onboarding-pulse pulse-one" aria-hidden="true" />
        <span className="onboarding-pulse pulse-two" aria-hidden="true" />
        <span className="onboarding-pulse pulse-three" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="onboarding-detail-visual" aria-label={`Инструкция: ${step.title}`}>
      <div className="onboarding-detail-icon">{visualIcons[step.icon || "ready"]}</div>
      <span>{step.eyebrow}</span>
      <div className="onboarding-visual-steps">
        {step.points.map((point, pointIndex) => (
          <div key={point}>
            <b>{pointIndex + 1}</b>
            <p>{point}</p>
          </div>
        ))}
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
    const completed = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "completed";
    const shouldAutoOpen = shouldAutoOpenOnboarding({ pathname: url.pathname, requested: requestedAfterRegistration, completed });

    if (requestedAfterRegistration) {
      url.searchParams.delete("onboarding");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (shouldAutoOpen) window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "pending");
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
        <button className="onboarding-skip" type="button" onClick={close}>Пропустить обучение</button>
        <div className="onboarding-visual">
          <StepVisual step={current} index={step} />
        </div>
        <div className="onboarding-content">
          <span className="onboarding-eyebrow">{current.eyebrow}</span>
          <h2 id="onboarding-title">{current.title}</h2>
          <p id="onboarding-description">{current.description}</p>
          <ol className="onboarding-instructions">
            {current.points.map((point) => <li key={point}>{point}</li>)}
          </ol>
          <div className="onboarding-progress" aria-label={`Шаг ${step + 1} из ${steps.length}`}>
            {steps.map((item, index) => (
              <button key={item.title} type="button" className={index === step ? "active" : ""} onClick={() => setStep(index)} aria-label={`Перейти к шагу ${index + 1}: ${item.title}`} aria-current={index === step ? "step" : undefined} />
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
