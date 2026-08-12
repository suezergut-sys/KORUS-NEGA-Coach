import type { CaseRole } from "@/lib/case-types";

export const OPPONENT_PORTRAITS = {
  female: [
    "/opponents/female-01.webp",
    "/opponents/female-02.webp",
    "/opponents/female-03.webp",
    "/opponents/female-04.webp",
    "/opponents/female-05.webp",
    "/opponents/female-06.webp",
  ],
  male: [
    "/opponents/male-01.webp",
    "/opponents/male-02.webp",
    "/opponents/male-03.webp",
    "/opponents/male-04.webp",
    "/opponents/male-05.webp",
    "/opponents/male-06.webp",
  ],
} as const;

function stableNameHash(value: string) {
  let hash = 0x811c9dc5;
  for (const character of value.normalize("NFC").trim().toLocaleLowerCase("ru")) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function opponentPortraitForRole(role: Pick<CaseRole, "name" | "voiceGender">) {
  const portraits = OPPONENT_PORTRAITS[role.voiceGender];
  return portraits[stableNameHash(role.name) % portraits.length];
}
