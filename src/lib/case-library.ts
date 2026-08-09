import type { CanonicalCase } from "@/lib/case-types";

export type CaseLibraryItem = CanonicalCase & {
  createdAt: string;
  createdBy: string;
  plays: number;
  comicImage: string | null;
};

export function publicCaseAuthor(value: unknown, origin: CanonicalCase["origin"]) {
  const raw = String(value || "").trim();
  const withoutEmail = raw.split("·")[0].replace(/\S+@\S+/g, "").replace(/\s+/g, " ").trim();
  if (withoutEmail && !withoutEmail.includes("@")) return withoutEmail;
  return origin === "seed" ? "Команда KORUS" : "Автор не указан";
}

export function sortCaseLibrary(items: CaseLibraryItem[]) {
  return [...items].sort((a, b) => b.plays - a.plays || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
