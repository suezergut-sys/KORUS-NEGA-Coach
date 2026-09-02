import type { DetectedAntiPattern } from "@/lib/analysis-types";

type MethodologyAtom = {
  id: string;
  kind: string;
  title: string;
  statement: string;
};

function normalizeQuote(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[«»„“”\"'.,!?;:—–-]/g, " ").replace(/\s+/g, " ").trim();
}

export function antiPatternAnalysisInstructions(hasAntiPatterns: boolean) {
  if (!hasAntiPatterns) return "Поле antiPatterns верни пустым массивом.";
  return `
Атомы типа anti_pattern — запрещённые манипулятивные антиприёмы. Проверь только реплики человека: если он явно применил такой антиприём или смысловой аналог, добавь его в antiPatterns, скопируй methodologyAtomId из [АТОМ id], а turnQuote — дословно из стенограммы. Не отмечай реплики оппонента и не считай антиприёмом нейтральное обсуждение риска, процедуры или чужой формулировки. Если совпадений нет, верни пустой массив. Не применяй отдельный числовой штраф в scoreBreakdown: сервер рассчитает его после проверки цитат.
  `.trim();
}

export function sanitizeDetectedAntiPatterns(
  detected: DetectedAntiPattern[] | undefined,
  atoms: MethodologyAtom[],
  participantTurns: string[],
) {
  if (!detected?.length) return [];
  const antiPatterns = new Map(atoms.filter((atom) => atom.kind === "anti_pattern").map((atom) => [atom.id, atom]));
  const turns = participantTurns.map(normalizeQuote).filter(Boolean);
  const seen = new Set<string>();

  return detected.flatMap((item) => {
    const atom = antiPatterns.get(item.methodologyAtomId);
    const quote = String(item.turnQuote || "").trim();
    const normalizedQuote = normalizeQuote(quote);
    if (!atom || normalizedQuote.length < 4 || !turns.some((turn) => turn.includes(normalizedQuote)) || seen.has(atom.id)) return [];
    seen.add(atom.id);
    return [{ methodologyAtomId: atom.id, name: atom.title, turnQuote: quote, explanation: atom.statement }];
  }).slice(0, 13);
}
