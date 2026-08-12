export type NegotiationStyle = "collaborative" | "hard";

export type OpponentEmotionTone = "calm" | "guarded" | "interested" | "open" | "irritated" | "angry";

export type OpponentEmotionTrigger =
  | "respect"
  | "question"
  | "concrete_offer"
  | "concession"
  | "apology"
  | "pressure"
  | "personal_attack"
  | "evasion"
  | "interruption";

export type OpponentEmotionState = {
  trust: number;
  tension: number;
  irritation: number;
  dominance: number;
  engagement: number;
  tone: OpponentEmotionTone;
};

export type OpponentEmotionUpdate = {
  state: OpponentEmotionState;
  triggers: OpponentEmotionTrigger[];
};

const MAX_SHIFT_PER_TURN = 18;

const SIGNAL_PATTERNS: Record<Exclude<OpponentEmotionTrigger, "interruption">, RegExp> = {
  respect: /(?:^|[^\p{L}\p{N}])(спасибо|благодарю|понимаю\s+(вас|вашу|ваши)|слышу\s+вас|ценю|уважаю|справедлив(?:о|ый|ая))(?=$|[^\p{L}\p{N}])/u,
  question: /\?|(?:^|[^\p{L}\p{N}])(почему|зачем|как|что|какие|какой|какая|когда|где|сколько|можете\s+ли|готовы\s+ли)(?=$|\s)/u,
  concrete_offer: /(?:^|[^\p{L}\p{N}])(предлагаю|давайте|можем|(?:я|мы)\s+готов(?:ы|а)?|готов(?:ы|а)?\s+(?:предложить|взять|зафиксировать|обсудить|согласиться|уступить|дать)|зафиксируем|фиксируем|срок|процент|рубл(?:ей|я|ь)|дн(?:я|ей)|час(?:а|ов)?|до\s+\d{1,2})(?=$|[^\p{L}\p{N}])|\d/u,
  concession: /(?:^|[^\p{L}\p{N}])(согласен|согласна|принимаю|уступ(?:лю|аем|ка)|пойд(?:у|ем)\s+навстречу|готов(?:ы|а)?\s+согласиться|можем\s+уступить)(?=$|[^\p{L}\p{N}])/u,
  apology: /(?:^|[^\p{L}\p{N}])(извините|извиняюсь|прошу\s+прощения|сожалею|не\s+хотел(?:а)?)(?=$|[^\p{L}\p{N}])/u,
  pressure: /(?:^|[^\p{L}\p{N}])(требую|обязаны|должны|иначе|ультиматум|последн(?:ий|яя)\s+шанс|без\s+вариантов|не\s+обсуждается|немедленно)(?=$|[^\p{L}\p{N}])/u,
  personal_attack: /(?:^|[^\p{L}\p{N}])(виноват(?:ы|а)?|провал(?:или)?|некомпетент(?:ны|ен|на)?|бесполезн(?:ы|ый|ая)|лж[её]те|вр[её]те|обман(?:ули|ываете)|безответственн(?:ы|ый|ая))(?=$|[^\p{L}\p{N}])/u,
  evasion: /(?:^|[^\p{L}\p{N}])(не\s+знаю|посмотрим|как-нибудь|когда-нибудь|потом\s+решим|это\s+не\s+ко\s+мне|без\s+комментариев|не\s+готов(?:а)?\s+ответить)(?=$|[^\p{L}\p{N}])/u,
};

const TRIGGER_LABELS: Record<OpponentEmotionTrigger, string> = {
  respect: "уважительно признал позицию оппонента",
  question: "задал содержательный вопрос",
  concrete_offer: "предложил конкретные условия",
  concession: "сделал уступку или принял часть условий",
  apology: "извинился или признал нежелательный эффект",
  pressure: "усилил давление или предъявил ультимативное требование",
  personal_attack: "перешёл на обвинение или личную атаку",
  evasion: "ушёл от содержательного ответа",
  interruption: "перебил оппонента",
};

const DELIVERY_BY_TONE: Record<OpponentEmotionTone, string> = {
  calm: "Говори спокойно, ровно и уверенно. Сохраняй деловой темп и естественные короткие паузы.",
  guarded: "Говори заметно сдержаннее и суше предыдущей спокойной реплики. Перед ответом сделай короткую паузу, чуть замедли темп, проверяй конкретику и не спеши доверять обещаниям.",
  interested: "Говори живее и внимательнее, с заметным деловым интересом. Уточняй условия, но не соглашайся без разумного обмена.",
  open: "Говори теплее и спокойнее, показывая готовность искать решение. Не становись уступчивым без причины и сохраняй интересы роли.",
  irritated: "Говори явно холоднее и жёстче предыдущей реплики: короткими фразами, с плотной артикуляцией и напряжёнными паузами перед ключевыми словами. Раздражение должно быть слышно, но не повышай голос и не груби.",
  angry: "Говори жёстко, отрывисто и отчётливо жёстче предыдущей реплики, немного быстрее и с контролируемым усилением голоса. Недовольство должно быть очевидно на слух, но не кричи, не оскорбляй и оставайся в деловых границах.",
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function boundedScore(current: number, delta: number) {
  const boundedDelta = Math.max(-MAX_SHIFT_PER_TURN, Math.min(MAX_SHIFT_PER_TURN, delta));
  return clampScore(current + boundedDelta);
}

function normalizeTranscript(transcript: string) {
  return transcript.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim();
}

export function opponentEmotionTone(state: Omit<OpponentEmotionState, "tone">): OpponentEmotionTone {
  if (state.irritation >= 74 || (state.tension >= 82 && state.trust <= 24)) return "angry";
  if (state.irritation >= 48 || state.tension >= 66) return "irritated";
  if (state.trust >= 68 && state.tension <= 34) return "open";
  if (state.engagement >= 70 && state.trust >= 48) return "interested";
  if (state.tension >= 44 || state.trust <= 30) return "guarded";
  return "calm";
}

export function createInitialOpponentEmotion(style: NegotiationStyle): OpponentEmotionState {
  const scores = style === "hard"
    ? { trust: 25, tension: 55, irritation: 25, dominance: 75, engagement: 50 }
    : { trust: 42, tension: 32, irritation: 12, dominance: 50, engagement: 62 };
  return { ...scores, tone: opponentEmotionTone(scores) };
}

export function updateOpponentEmotion(
  current: OpponentEmotionState,
  input: { transcript: string; interruptedOpponent: boolean; style: NegotiationStyle },
): OpponentEmotionUpdate {
  const transcript = normalizeTranscript(input.transcript);
  if (!transcript) return { state: current, triggers: [] };

  const triggers: OpponentEmotionTrigger[] = (Object.entries(SIGNAL_PATTERNS) as Array<[Exclude<OpponentEmotionTrigger, "interruption">, RegExp]>)
    .filter(([, pattern]) => pattern.test(transcript))
    .map(([trigger]) => trigger);
  const removeTrigger = (trigger: OpponentEmotionTrigger) => {
    const index = triggers.indexOf(trigger);
    if (index >= 0) triggers.splice(index, 1);
  };
  if (/(?:^|[^\p{L}\p{N}])не\s+(?:понимаю|слышу|ценю|уважаю)(?=$|[^\p{L}\p{N}])/u.test(transcript)) removeTrigger("respect");
  if (/(?:^|[^\p{L}\p{N}])не\s+(?:согласен|согласна|принимаю|уступлю|готов(?:а)?\s+согласиться)(?=$|[^\p{L}\p{N}])/u.test(transcript)) removeTrigger("concession");
  if (/(?:^|[^\p{L}\p{N}])давайте\s+(?:как-нибудь|когда-нибудь|потом)(?=$|[^\p{L}\p{N}])/u.test(transcript)) removeTrigger("concrete_offer");
  if (input.interruptedOpponent) triggers.push("interruption");

  const delta = {
    trust: 0,
    tension: -2,
    irritation: -2,
    dominance: 0,
    engagement: 0,
  };
  const apply = (change: Partial<typeof delta>) => {
    for (const [key, value] of Object.entries(change) as Array<[keyof typeof delta, number]>) delta[key] += value;
  };

  for (const trigger of triggers) {
    if (trigger === "respect") apply({ trust: 8, tension: -5, irritation: -4, engagement: 5 });
    if (trigger === "question") apply({ trust: 3, engagement: 5 });
    if (trigger === "concrete_offer") apply({ trust: 5, tension: -3, engagement: 12 });
    if (trigger === "concession") apply({ trust: 10, tension: -9, irritation: -7, dominance: -3, engagement: 10 });
    if (trigger === "apology") apply({ trust: 8, tension: -10, irritation: -12, dominance: -2, engagement: 4 });
    if (trigger === "pressure") apply({ trust: -8, tension: 12, irritation: 10, dominance: 8, engagement: -4 });
    if (trigger === "personal_attack") apply({ trust: -15, tension: 18, irritation: 18, dominance: 10, engagement: -10 });
    if (trigger === "evasion") apply({ trust: -5, irritation: 8, dominance: 5, engagement: -4 });
    if (trigger === "interruption") apply({ trust: -6, tension: 10, irritation: 14, dominance: 8, engagement: -4 });
  }

  if (input.style === "hard") {
    delta.dominance += 2;
    if (delta.tension < 0) delta.tension = Math.ceil(delta.tension * 0.75);
    if (delta.irritation < 0) delta.irritation = Math.ceil(delta.irritation * 0.75);
  } else if (delta.tension > 0 || delta.irritation > 0) {
    delta.engagement += 2;
  }

  const scores = {
    trust: boundedScore(current.trust, delta.trust),
    tension: boundedScore(current.tension, delta.tension),
    irritation: boundedScore(current.irritation, delta.irritation),
    dominance: boundedScore(current.dominance, delta.dominance),
    engagement: boundedScore(current.engagement, delta.engagement),
  };
  let tone = opponentEmotionTone(scores);
  if (input.interruptedOpponent && tone !== "angry" && tone !== "irritated") {
    tone = current.tone === "guarded" || current.tone === "irritated" ? "irritated" : "guarded";
  }
  return { state: { ...scores, tone }, triggers };
}

export function buildOpponentEmotionInstructions(
  state: OpponentEmotionState,
  triggers: readonly OpponentEmotionTrigger[] = [],
) {
  const reaction = triggers.length
    ? `В последнем ходе пользователь: ${triggers.map((trigger) => TRIGGER_LABELS[trigger]).join("; ")}.`
    : "Это исходное эмоциональное состояние персонажа в начале разговора.";
  const interruptionDirection = triggers.includes("interruption")
    ? "Пользователь перебил тебя. Начни с короткой заметной паузы и сделай смену интонации различимой на слух уже в этой реплике."
    : "";

  return `
# Эмоциональная режиссура этой реплики
Внутреннее состояние: доверие ${state.trust}/100, напряжение ${state.tension}/100, раздражение ${state.irritation}/100, стремление контролировать разговор ${state.dominance}/100, интерес к соглашению ${state.engagement}/100.
${reaction}
${interruptionDirection}
${DELIVERY_BY_TONE[state.tone]}
Вырази состояние естественно через интонацию, темп, паузы, краткость и выбор слов. Учитывай также реально услышанную интонацию пользователя и весь предыдущий разговор. Не называй эмоцию, состояние, триггеры или числовые значения вслух. Не переигрывай и не меняй настроение скачком. Сохраняй роль, цели, ограничения и правила переговоров из инструкций сессии.
`.trim();
}
