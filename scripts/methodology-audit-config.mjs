export const METHODOLOGY_AUDIT = {
  "SRC-001": {
    releaseVersion: "tarasov-v1",
    expectedAtoms: 34,
    expectedKinds: { principle: 26, case_rule: 1, stratagem: 3, example: 1, evaluation_criterion: 3 },
    corrections: {
      "Кандидат: правильное решение дает побочные эффекты в виде решения других задач": ["case_rule", "principle"],
      "Ненадёжность союзника, которому отведена невыгодная роль": ["case_rule", "principle"],
      "Ролевое принуждение как передвижение по ролевому полю": ["case_rule", "principle"],
      "Совпадение представлений об этапах ведет к перемирию": ["case_rule", "principle"],
      "Совпадение прогнозов прекращает борьбу": ["case_rule", "principle"],
      "Эффективность ролевого принуждения": ["evaluation_criterion", "principle"],
    },
  },
  "SRC-002": {
    releaseVersion: "harvard-v1",
    expectedAtoms: 37,
    expectedKinds: { principle: 19, case_rule: 0, stratagem: 16, example: 0, evaluation_criterion: 2 },
    corrections: {
      "Излагать интересы и аргументы до предложения": ["case_rule", "stratagem"],
      "Отделять генерацию вариантов от их оценки": ["case_rule", "stratagem"],
      "Снижать барьер для согласия другой стороны": ["case_rule", "stratagem"],
    },
  },
  "SRC-003": {
    releaseVersion: "conflicts-v1",
    expectedAtoms: 18,
    expectedKinds: { principle: 11, case_rule: 0, stratagem: 6, example: 0, evaluation_criterion: 1 },
    corrections: {
      "Конфликт понятий возникает при разном понимании одного слова": ["case_rule", "principle"],
      "Конфликт ролей или функций может быть нормальным": ["case_rule", "principle"],
      "Конфликт целей проясняется через вопросы о цели и смысле": ["case_rule", "stratagem"],
      "Конфликт ценностей трудно разрешим": ["case_rule", "principle"],
      "Бережно работать с эмоциональной потребностью": ["evaluation_criterion", "stratagem"],
      "Диагностировать уровень конфликта": ["evaluation_criterion", "stratagem"],
    },
  },
};

export const METHODOLOGY_KIND_DEFINITIONS = {
  principle: "Базовая идея или закономерность, объясняющая, почему подход работает.",
  case_rule: "Конкретное условие учебного кейса, задающее границы упражнения.",
  stratagem: "Тактический приём: конкретный способ действия в переговорах.",
  example: "Иллюстрация применения принципа, правила или тактического приёма.",
  evaluation_criterion: "Измеримый признак качества действий участника.",
};
