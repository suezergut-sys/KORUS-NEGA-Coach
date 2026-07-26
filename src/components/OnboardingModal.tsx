"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ONBOARDING_STORAGE_KEY, shouldAutoOpenOnboarding } from "@/lib/onboarding";

export const ONBOARDING_OPEN_EVENT = "nega:onboarding:open";

type OnboardingStep = {
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
  visual?: {
    src: string;
    alt: string;
    className: string;
    secondarySrc?: string;
    secondaryAlt?: string;
  };
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
    points: ["Диалоги — вернуться к тренажёру", "Профиль и диаграмма — кабинет и рейтинг", "Стрелка, плюс и документ — работа с кейсами", "Кнопка выхода — завершить пользовательскую сессию"],
    visual: { src: "/onboarding/navigation.png", alt: "Панель навигации и настройки тренажёра", className: "navigation" },
  },
  {
    eyebrow: "ШАГ 2 · ПЕРЕГОВОРЫ",
    title: "Выберите кейс и свою роль",
    description: "Главная страница — рабочее место переговорщика. Сначала задайте ситуацию и сторону, за которую будете играть.",
    points: ["Откройте список кейсов и выберите сценарий", "Нажмите «Содержание кейса» и изучите вводные", "Выберите свою роль — AI получит одну из остальных", "Проверьте цели, интересы и ограничения своей стороны"],
    visual: { src: "/onboarding/main-interface.png", alt: "Выбор кейса и роли в настройках переговоров", className: "case-selection" },
  },
  {
    eyebrow: "ШАГ 3 · НАСТРОЙКА",
    title: "Настройте формат тренировки",
    description: "Перед запуском задайте поведение оппонента и удобный способ разговора. Во время активного поединка эти настройки блокируются.",
    points: ["Выберите методику, по которой получите разбор", "Задайте стиль AI-оппонента", "Установите длительность переговоров", "Выберите открытый микрофон или режим «Удерживать, чтобы говорить»"],
    visual: { src: "/onboarding/home.png", alt: "Панель настройки формата переговоров", className: "settings" },
  },
  {
    eyebrow: "ШАГ 4 · ПОЕДИНОК",
    title: "Проведите и завершите переговоры",
    description: "Когда всё готово, запускайте голосовой диалог. Реплики появятся в центре экрана, а после завершения система подготовит подробный разбор.",
    points: ["Нажмите «Начать» и разрешите доступ к микрофону", "Следите за таймером и расшифровкой реплик", "При необходимости используйте одну паузу и подсказку", "Нажмите «Завершить» и дождитесь анализа результата"],
    visual: { src: "/onboarding/home.png", alt: "Область голосовых переговоров с кнопками управления", className: "live-session" },
  },
  {
    eyebrow: "ШАГ 5 · ЛИЧНЫЙ КАБИНЕТ",
    title: "Отслеживайте свой прогресс",
    description: "Личный кабинет собирает только рейтинговые тренировки и помогает увидеть динамику без ручных записей.",
    points: ["Смотрите число поединков и процент побед", "Проверяйте дату последней тренировки", "Изучайте три наиболее часто сыгранных кейса", "Открывайте историю с ролью, результатом и баллом"],
    visual: { src: "/onboarding/account.png", alt: "Метрики и статистика личного кабинета", className: "account" },
  },
  {
    eyebrow: "ШАГ 6 · РЕЙТИНГ",
    title: "Сравнивайте результаты",
    description: "Общий рейтинг показывает показатели участников и помогает понять своё место среди коллег.",
    points: ["Откройте раздел со значком диаграммы", "Сравните поединки, победы и долю побед", "Посмотрите средний балл последних тренировок", "Нажимайте заголовки таблицы для сортировки"],
    visual: { src: "/onboarding/rating.png", alt: "Показатели таблицы рейтинга участников", className: "rating" },
  },
  {
    eyebrow: "ШАГ 7 · СВОИ КЕЙСЫ",
    title: "Загружайте или создавайте сценарии",
    description: "Для быстрого старта загрузите готовый материал. Если нужен новый сценарий с несколькими вариантами, используйте конструктор.",
    points: ["Стрелка вверх — быстрая загрузка готового кейса", "Добавьте файл и дождитесь обработки", "Плюс — конструктор нового кейса из материалов и заметок", "Проверьте вариант и опубликуйте его в библиотеке"],
    visual: {
      src: "/onboarding/quick-upload.png",
      alt: "Окно быстрой загрузки кейса",
      className: "case-tools",
      secondarySrc: "/onboarding/case-builder.png",
      secondaryAlt: "Конструктор собственного кейса",
    },
  },
  {
    eyebrow: "ШАГ 8 · ВНЕШНИЙ АНАЛИЗ",
    title: "Разбирайте проведённые переговоры",
    description: "Раздел с документом и лупой нужен, когда разговор прошёл вне тренажёра, но вы хотите получить методический разбор.",
    points: ["Загрузите текст кейса", "Добавьте файл с расшифровкой разговора", "Укажите обозначения обоих участников", "Запустите анализ и изучите рекомендации"],
    visual: { src: "/onboarding/external-analysis.png", alt: "Форма анализа проведённого поединка", className: "external-analysis" },
  },
  {
    eyebrow: "ГОТОВО",
    title: "Можно начинать тренировку",
    description: "Вернитесь на главную страницу, выберите кейс и проведите первый поединок. Это обучение всегда доступно в блоке «Помощь» личного кабинета.",
    points: ["Выберите кейс", "Настройте роль и формат", "Нажмите «Начать»", "Изучите итоговый разбор"],
    visual: { src: "/onboarding/home.png", alt: "Главный экран тренажёра переговоров", className: "ready" },
  },
];

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

  if (!step.visual) return null;

  return (
    <figure className={`onboarding-interface-visual ${step.visual.className}`}>
      <div className="onboarding-screenshot-frame">
        <Image src={step.visual.src} alt={step.visual.alt} fill sizes="430px" priority={index === 1} />
      </div>
      {step.visual.secondarySrc && (
        <div className="onboarding-screenshot-frame secondary">
          <Image src={step.visual.secondarySrc} alt={step.visual.secondaryAlt || ""} fill sizes="260px" />
        </div>
      )}
      <figcaption>РЕАЛЬНЫЙ ИНТЕРФЕЙС СЕРВИСА</figcaption>
    </figure>
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
