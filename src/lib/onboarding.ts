import type { OnboardingContentIcon } from "@/lib/app-section-icons";

export type OnboardingCapability = {
  title: string;
  description: string;
  icon: OnboardingContentIcon;
};

export type OnboardingStep = {
  id: "welcome" | "capabilities" | "negotiations" | "progress" | "cases" | "analysis" | "ready";
  kind: "welcome" | "overview" | "feature" | "final";
  eyebrow: string;
  title: string;
  description: string;
  why?: string;
  actions?: readonly string[];
  highlights?: readonly string[];
  capabilities?: readonly OnboardingCapability[];
  icons: readonly OnboardingContentIcon[];
  footer?: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "welcome",
    kind: "welcome",
    eyebrow: "ДОБРО ПОЖАЛОВАТЬ",
    title: "Развивай навыки переговоров через практику",
    description: "KORUS NEGA AI помогает системно развивать переговорные навыки, готовиться к конкретным рабочим ситуациям и получать методический разбор после каждой тренировки.",
    highlights: [
      "аудио не сохраняется, стенограмма — только с твоего согласия",
      "практика на готовых и собственных кейсах",
      "персональный разбор и рекомендации",
    ],
    icons: ["negotiations"],
  },
  {
    id: "capabilities",
    kind: "overview",
    eyebrow: "ВОЗМОЖНОСТИ ПЛАТФОРМЫ",
    title: "Всё необходимое для твоего развития",
    description: "Тренируйся с AI-оппонентом, готовь собственные сценарии, анализируй реальные разговоры и следи за своим прогрессом.",
    capabilities: [
      {
        title: "Тренировки",
        description: "Практикуй переговоры и получай обратную связь.",
        icon: "negotiations",
      },
      {
        title: "Свои кейсы",
        description: "Готовься к конкретным рабочим ситуациям.",
        icon: "create",
      },
      {
        title: "Анализ",
        description: "Разбирай переговоры, проведённые вне платформы.",
        icon: "analyze",
      },
      {
        title: "Прогресс",
        description: "Наблюдай за результатами и динамикой.",
        icon: "rating",
      },
      {
        title: "Всегда под рукой",
        description: "Платформа работает без VPN и адаптирована для телефона, поэтому ты можешь тренироваться и готовиться к переговорам даже в дороге.",
        icon: "mobile",
      },
    ],
    icons: [],
    footer: "Открой платформу на компьютере или телефоне — дополнительная установка не требуется.",
  },
  {
    id: "negotiations",
    kind: "feature",
    eyebrow: "ПЕРЕГОВОРНЫЕ ТРЕНИРОВКИ",
    title: "Тренируйся с AI-оппонентом",
    description: "Выбери готовый или собственный кейс, определи свою роль и проведи голосовые переговоры с AI-оппонентом. В дуплексе итоговый отчёт дополнится аналитикой живой речи.",
    why: "Чтобы безопасно отрабатывать сложные ситуации, проверять разные стратегии и увереннее вести реальные переговоры.",
    actions: [
      "выбери кейс и изучи вводные",
      "определи свою роль",
      "выбери «Дуплекс» для свободного диалога, перебиваний и речевой аналитики или «Обычный» режим для шумной среды",
      "при необходимости используй одну 60-секундную паузу; AI-подсказка поможет с ходом, но сделает поединок нерейтинговым",
      "заверши переговоры и изучи текстовый, а в дуплексе — ещё и речевой разбор",
    ],
    icons: ["negotiations"],
  },
  {
    id: "progress",
    kind: "feature",
    eyebrow: "ПРОГРЕСС",
    title: "Следи за своим прогрессом",
    description: "Личный кабинет сохраняет историю тренировок, карту навыков, личную цель и задания, а общий рейтинг помогает сравнивать рейтинговые результаты.",
    why: "Чтобы видеть динамику, замечать сильные стороны и понимать, над чем работать дальше.",
    actions: [
      "изучай историю тренировок и полученные баллы",
      "выбирай навык для развития и выполняй задания из разбора",
      "следи за количеством рейтинговых поединков и долей побед",
      "сравнивай свои показатели с результатами коллег",
      "управляй сроком хранения стенограмм, экспортируй или удаляй свои данные",
    ],
    icons: ["account", "rating"],
  },
  {
    id: "cases",
    kind: "feature",
    eyebrow: "СОБСТВЕННЫЕ КЕЙСЫ",
    title: "Готовься на собственных материалах",
    description: "Загрузи готовый кейс или создай новый сценарий с помощью AI-конструктора, выбрав общую или приватную видимость.",
    why: "Чтобы заранее отрепетировать конкретную рабочую ситуацию и проверить разные варианты поведения.",
    actions: [
      "используй быструю загрузку, если кейс уже подготовлен",
      "открой конструктор, если сценарий нужно собрать из файлов и заметок",
      "выбери: показать кейс всем участникам или оставить только в своей библиотеке",
      "проверь и опубликуй вариант; изображения и озвучка появятся позже, а текст будет доступен сразу",
    ],
    icons: ["upload", "create"],
  },
  {
    id: "analysis",
    kind: "feature",
    eyebrow: "АНАЛИЗ",
    title: "Разбирай реальные переговоры",
    description: "Получи методический разбор разговора, который состоялся вне платформы.",
    why: "Чтобы превратить уже проведённые переговоры в практические выводы и рекомендации для следующих встреч.",
    actions: [
      "загрузи описание ситуации",
      "добавь расшифровку разговора",
      "укажи обозначения участников",
      "запусти анализ и изучи рекомендации",
    ],
    icons: ["analyze"],
  },
  {
    id: "ready",
    kind: "final",
    eyebrow: "ПЕРВАЯ ТРЕНИРОВКА",
    title: "Ты готов к первой тренировке",
    description: "Начни с готового кейса — это самый быстрый способ познакомиться с платформой на практике.",
    actions: [
      "выбери кейс",
      "выбери свою роль и формат тренировки",
      "начни переговоры и изучи итоговый разбор",
    ],
    icons: ["negotiations"],
  },
];

export const ONBOARDING_STORAGE_KEY = "korus-nega-onboarding-v4";

type OnboardingStorage = Pick<Storage, "getItem" | "setItem">;

export function getOnboardingStorage(source: { localStorage?: OnboardingStorage } | null | undefined) {
  try {
    return source?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readOnboardingCompleted(storage: OnboardingStorage | null | undefined) {
  try {
    return storage?.getItem(ONBOARDING_STORAGE_KEY) === "completed";
  } catch {
    return false;
  }
}

export function writeOnboardingCompleted(storage: OnboardingStorage | null | undefined) {
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, "completed");
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function clampOnboardingStep(index: number, total: number) {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

export function getOnboardingFocusWrapTarget<T>({
  active,
  container,
  first,
  last,
  shiftKey,
}: {
  active: T | null;
  container: T;
  first: T;
  last: T;
  shiftKey: boolean;
}) {
  if (shiftKey && (active === first || active === container)) return last;
  if (!shiftKey && active === last) return first;
  return null;
}

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export function shouldAutoOpenOnboarding({
  pathname,
  requested,
  completed,
}: {
  pathname: string;
  requested: boolean;
  completed: boolean;
}) {
  if (requested) return true;
  const isAuthenticatedArea = !PUBLIC_PATHS.has(pathname) && !pathname.startsWith("/admin");
  return isAuthenticatedArea && !completed;
}
