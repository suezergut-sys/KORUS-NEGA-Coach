export type AgreementTurn = {
  id: string;
  author: "Вы" | "Оппонент" | "Система";
  text: string;
};

export type ReachedAgreement = {
  key: string;
  participantTurnId: string;
  opponentTurnId: string;
};

const EXPLICIT_ACCEPTANCE_PATTERNS = [
  /(?:^| )договорились(?: |$)/u,
  /(?:^| )(?:я|мы)\s+соглас(?:ен|на|ны)(?: |$)/u,
  /^соглас(?:ен|на)(?: |$)/u,
  /(?:^| )по\s+рукам(?: |$)/u,
  /(?:^| )принима(?:ю|ем)\s+(?:эти\s+|ваши\s+)?услови/u,
  /(?:^| )меня\s+(?:это|такой\s+вариант|такие\s+условия)\s+устраив/u,
  /(?:^| )дава(?:й|йте)\s+(?:так|на\s+этом|по\s+этому\s+плану)(?: |$)/u,
  /(?:^| )так\s+и\s+будем(?:\s+действовать)?(?: |$)/u,
];

const PROPOSAL_PATTERNS = [
  /(?:^| )предлага(?:ю|ем)(?: |$)/u,
  /(?:^| )мое\s+предложение(?: |$)/u,
  /(?:^| )дава(?:й|йте)(?: |$)/u,
  /(?:^| )тогда .{0,80}(?:сдела(?:ю|ем)|поступим|зафиксируем|подпишем|будем)(?: |$)/u,
  /(?:^| )готов(?:а|ы)? .{0,80}(?:сделать|предоставить|согласовать|подписать|выплатить|перейти|принять)(?: |$)/u,
];

function normalize(text: string) {
  return text
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExplicitAcceptance(text: string) {
  if (/\?\s*$/u.test(text.trim())) return false;
  const normalized = normalize(text);
  return EXPLICIT_ACCEPTANCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isProposal(text: string) {
  const normalized = normalize(text);
  return PROPOSAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isShortAcceptance(text: string) {
  return /^(?:да|хорошо|ладно|ок|окей)(?:\s+так)?$/u.test(normalize(text));
}

export function detectReachedAgreement(turns: readonly AgreementTurn[]): ReachedAgreement | null {
  const recent = turns
    .filter((turn) => turn.author === "Вы" || turn.author === "Оппонент")
    .filter((turn) => turn.text.trim())
    .slice(-8);

  for (let laterIndex = recent.length - 1; laterIndex > 0; laterIndex -= 1) {
    const later = recent[laterIndex];
    const laterAccepts = isExplicitAcceptance(later.text);
    const laterBrieflyAccepts = isShortAcceptance(later.text);
    if (!laterAccepts && !laterBrieflyAccepts) continue;

    for (let earlierIndex = laterIndex - 1; earlierIndex >= Math.max(0, laterIndex - 4); earlierIndex -= 1) {
      const earlier = recent[earlierIndex];
      if (earlier.author === later.author) continue;
      const earlierCommits = isExplicitAcceptance(earlier.text) || isProposal(earlier.text);
      if (!earlierCommits) continue;

      const participant = later.author === "Вы" ? later : earlier;
      const opponent = later.author === "Оппонент" ? later : earlier;
      return {
        key: `${earlier.id}:${later.id}`,
        participantTurnId: participant.id,
        opponentTurnId: opponent.id,
      };
    }
  }

  return null;
}
