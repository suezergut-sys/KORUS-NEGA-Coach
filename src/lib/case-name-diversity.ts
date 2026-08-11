import type { GeneratedCaseVariant } from "@/lib/case-types";

type StoredCaseRoles = {
  user_role?: unknown;
  opponent_role?: unknown;
  additional_roles?: unknown;
};

export type BlockedCaseNames = {
  fullNames: string[];
  firstNames: string[];
};

const LEGACY_DEFAULT_NAMES = ["Ирина Соколова", "Алексей Воронцов"];

function normalized(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU");
}

function roleName(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

export function recentCaseCharacterNames(rows: StoredCaseRoles[]) {
  const names = rows.flatMap((row) => [
    roleName(row.user_role),
    roleName(row.opponent_role),
    ...(Array.isArray(row.additional_roles) ? row.additional_roles.map(roleName) : []),
  ]).filter(Boolean);
  return [...new Map(names.map((name) => [normalized(name), name])).values()];
}

export function blockedCaseCharacterNames(recentNames: string[], sourceText: string): BlockedCaseNames {
  const source = normalized(sourceText);
  const fullNames = [...new Map([...LEGACY_DEFAULT_NAMES, ...recentNames].map((name) => [normalized(name), name])).values()]
    .filter((name) => !source.includes(normalized(name)));
  const firstNames = [...new Set(fullNames.map((name) => name.split(/\s+/)[0]).filter(Boolean))];
  return { fullNames, firstNames };
}

export function assertDiverseCaseCharacterNames(
  variants: GeneratedCaseVariant[],
  blocked: BlockedCaseNames,
  sourceText: string,
) {
  const blockedFull = new Set(blocked.fullNames.map(normalized));
  const blockedFirst = new Set(blocked.firstNames.map(normalized));
  const source = normalized(sourceText);
  const generatedFull = new Set<string>();
  const generatedFirst = new Set<string>();

  for (const variant of variants) {
    const roles = [variant.userRole, variant.opponentRole, ...variant.additionalRoles];
    const variantFull = new Set<string>();
    const variantFirst = new Set<string>();
    for (const role of roles) {
      const fullName = normalized(role.name);
      const firstName = fullName.split(/\s+/)[0] || "";
      if (variantFull.has(fullName) || variantFirst.has(firstName)) {
        throw new Error("У персонажей одного кейса должны быть разные имена и фамилии.");
      }
      if (blockedFull.has(fullName) || blockedFirst.has(firstName)) {
        throw new Error(`Имя «${role.name}» уже использовалось в недавних кейсах. Сгенерируйте вариант с другими персонажами.`);
      }
      const explicitlyNamed = source.includes(fullName);
      if (!explicitlyNamed && (generatedFull.has(fullName) || generatedFirst.has(firstName))) {
        throw new Error(`Имя «${role.name}» повторяется в сгенерированных вариантах. Персонажи вариантов должны различаться.`);
      }
      variantFull.add(fullName);
      variantFirst.add(firstName);
      generatedFull.add(fullName);
      generatedFirst.add(firstName);
    }
  }
}
