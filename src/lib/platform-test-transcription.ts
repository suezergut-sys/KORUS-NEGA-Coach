export function addTranscriptionItem(order: readonly string[], itemId: string) {
  const normalizedId = itemId.trim();
  if (!normalizedId || order.includes(normalizedId)) return [...order];
  return [...order, normalizedId];
}

export function combineTranscriptionFragments(
  order: readonly string[],
  fragments: ReadonlyMap<string, string>,
) {
  const orderedIds = order.length
    ? order
    : [...fragments.keys()];

  return orderedIds
    .map((itemId) => fragments.get(itemId)?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
