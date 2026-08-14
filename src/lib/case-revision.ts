import type { GeneratedCaseVariant } from "@/lib/case-types";

export const CASE_REVISION_MAX_LENGTH = 6000;

export function parseCaseRevisionInstructions(value: unknown) {
  const instructions = typeof value === "string" ? value.trim().slice(0, CASE_REVISION_MAX_LENGTH) : "";
  if (instructions.length < 3) throw new Error("Опишите, что нужно изменить в выбранном варианте.");
  return instructions;
}

export function buildCaseRevisionInput(variant: GeneratedCaseVariant, instructions: string) {
  return `
ИСПРАВЛЯЕМЫЙ ВАРИАНТ:
${JSON.stringify(variant, null, 2)}

КОРРЕКТИРОВКИ ПОЛЬЗОВАТЕЛЯ:
${instructions}
  `.trim();
}
